var path = require('path')
  , fs = require(path.join('..', 'util', 'fs'))  // use existsSync in 0.6.x
  , glob = require('glob')
  , et = require('elementtree')
  , xcode = require('xcode')
  , plist = require('plist')
  , bplist = require('bplist-parser')
  , shell = require('shelljs')
  , platform_helpers = require(path.join(__dirname, '..', 'util', 'platform-helpers'))
  , assetsDir = 'www';    // relative path to project's web assets

/**
 * install or uninstall a plugin for an ios xcode project
 *
 * @param enumeration action     install | uninstall
 * @param path project_dir root directory in the xcode project
 * @param path plugin_dir root directory in the plugin to install
 * @param elementtree plugin_et plugin configuration object 
 */
exports.handlePlugin = function (action, project_dir, plugin_dir, plugin_et) {
    var plugin_id = plugin_et._root.attrib['id']
      , version = plugin_et._root.attrib['version']
      , external_hosts = []
      , i = 0
      , matched
      , project_plist_file
      , xcode_plugin_dir
      , project_www_dir
      , xcode_resource_dir;

    // fail if the package is already installed
    if (action === 'install' && platform_helpers.pluginInstalled(project_dir, plugin_id)) {
        throw new Error('plugin ' + plugin_id + ' is already installed');
    }

    // TODO: hoist error checking to fail before making changes needing undo

    // find the project.pbxproj file, parse it, apply changes
    processPbx(action, project_dir, plugin_dir, plugin_id, plugin_et);

    // find Cordova.plist or Phonegap.plist within the ios xcode project
    project_plist_file = findXcodeProjectPlistFile(project_dir);

    // apply changes to the ios xcode plist file
    processPlist(action, project_plist_file, plugin_et);

    // find the Plugins/ directory in the xcode project
    xcode_plugin_dir = path.resolve(project_plist_file, '..', 'Plugins', plugin_id);

    // find the Resources/ directory in the xcode project
    //xcode_resource_dir = path.resolve(project_plist_file, '..', 'Resources', plugin_id);

    // copy all of the native and www assets from the plugin into the project
    project_www_dir = path.join(project_dir, 'www', plugin_id);

    if (action === 'install') {
        platform_helpers.copyFiles('ios', plugin_dir, project_www_dir, xcode_plugin_dir);
    } else {
        platform_helpers.removeFiles(project_www_dir, xcode_plugin_dir);
    }
}

function processPbx(action, project_dir, plugin_dir, plugin_id, plugin_et) {
    var pbxPaths
      , xcodeproj
      , platformTag = plugin_et.find('./platform[@name="ios"]')
      , frameworks = platformTag.findall('./framework')
      , i = 0, len = 0
      , f = null, file = null
      , file_type = null
      , file_name = null;

    pbxPaths = glob.sync(project_dir + '/**/project.pbxproj');
    if (!pbxPaths.length) throw new Error(project_dir + ' does not appear to be an xcode project');

    xcodeproj = xcode.project(pbxPaths[0]);
    xcodeproj.parseSync();

    frameworks.forEach(function (framework) {
        var src = framework.attrib['src'];
        if (action === 'install') {
            xcodeproj.addFramework(src);
        } else {
            xcodeproj.removeFramework(src);
        }
    });

    // iterate over each file in the plugin source directory.
    // depending on it's file extension add it to the xcode file
    // as a source, header, or resource file
    f = glob.sync(plugin_dir + '/native/ios/*');
    len = f.length;

    for (;i < len;i++) {
        file = f[i];
        file_type = path.extname(file);
        file_name = path.basename(file);

        // add or remove file references based on action (install vs uninstall)
        if (action === 'install') {
            if (file_type === '.h') {
                xcodeproj.addHeaderFile('Plugins/' + plugin_id + '/' + file_name);
            } 
            else if(file_type === '.m') {
                xcodeproj.addSourceFile('Plugins/' + plugin_id + '/' + file_name);
            }
            else {
                //xcodeproj.addResourceFile('Resources/' + plugin_id + '/' + file_name);
                xcodeproj.addResourceFile('Plugins/' + plugin_id + '/' + file_name);
            }
        } else {
            if (file_type === '.h') {
                xcodeproj.removeHeaderFile('Plugins/' + plugin_id + '/' + file_name);
            }
            else if(file_type === '.m') {
                xcodeproj.removeSourceFile('Plugins/' + plugin_id + '/' + file_name);
            }
            else {
                //xcodeproj.removeResourceFile('Resources/' + plugin_id + '/' + file_name);
                xcodeproj.removeResourceFile('Plugins/' + plugin_id + '/' + file_name);
            }
        } 
    }

    // write out xcodeproj file
    fs.writeFileSync(pbxPaths[0], xcodeproj.writeSync());
}

function processPlist(action, project_plist_file, plugin_et) {
    var pl;

    // determine if this is a binary or ascii plist and choose the parser
    // this is temporary until binary support is added to node-plist
    if( isBinaryPlist(project_plist_file) ) {
        pl = bplist;
    } else {
        pl = plist; 
    }

    plistObj = pl.parseFileSync(project_plist_file);

    var hosts = plugin_et.findall('./access')
      , platformTag = plugin_et.find('./platform[@name="ios"]')
      , plistEle = platformTag.find('./plist-add')
      , external_hosts = []
      , i = 0
      , matched;

    if (action === 'install') {
        // add hosts to whitelist (ExternalHosts) in plist
        hosts.forEach(function(host) {
            plistObj.ExternalHosts.push(host.attrib['origin']);
        });
    
        // add plugin to plist
        plistObj.Plugins[plistEle.attrib['key']] = plistEle.attrib['string'];
    }
    else {
        // remove hosts from whitelist (ExternalHosts) in plist
        // check each entry in external hosts, only add it to the plist if
        // it's not an entry added by this plugin 
        for(i=0; i < plistObj.ExternalHosts.length;i++) {
            matched = false;
            hosts.forEach(function(host) {
                if(host.attrib['origin'] === plistObj.ExternalHosts[i])
                {
                    matched = true;
                }
            });
            if (!matched) {
                external_hosts.push(plistObj.ExternalHosts[i]);
            }
        }

        // filtered the external hosts entries out, copy result
        plistObj.ExternalHosts = external_hosts;

        //remove the plist entries
        delete plistObj.Plugins[plistEle.attrib['key']];
    }

    // write out plist
    fs.writeFileSync(project_plist_file, plist.build(plistObj));
}

function findXcodeProjectPlistFile(project_dir) {
    // due to project name changes, the project may have a plist file named
    // Cordova or PhoneGap, so we need to look for both
    var files = glob.sync(project_dir + '/**/{PhoneGap,Cordova}.plist');
    if (!files.length) throw new Error(project_dir + ' does not appear to be a Cordova project');

    // files found under any build/ directory are temp files, filter them
    files = files.filter(function (val) {
        return !(/build\//.test(val));
    });

    if (!files.length) throw new Error("Xcode project's plist file not found");
    return files[0];
}

// determine if a plist file is binary
function isBinaryPlist(filename) {
    // I wish there was a synchronous way to read only the first 6 bytes of a
    // file. This is wasteful :/ 
    var buf = '' + fs.readFileSync(filename, 'utf8');
    // binary plists start with a magic header, "bplist"
    return buf.substring(0, 6) === 'bplist';
}
