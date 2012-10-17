var path = require('path')
  , fs = require(path.join('..', 'util', 'fs'))  // use existsSync in 0.6.x
  , glob = require('glob')
  , et = require('elementtree')
  , shell = require('shelljs')
  , xml_helpers = require(path.join(__dirname, '..', 'util', 'xml-helpers'))
  , platform_helpers = require(path.join(__dirname, '..', 'util', 'platform-helpers'))
  , assetsDir = 'assets/www'  // relative path to project's web assets
  , sourceDir = 'src';

/**
 * install or uninstall a plugin for an android project
 *
 * @param enumeration action     install | uninstall
 * @param path project_dir root directory in the android project
 * @param path plugin_dir root directory in the plugin to install
 * @param elementtree plugin_et plugin configuration object 
 */
exports.handlePlugin = function (action, project_dir, plugin_dir, plugin_et) {
    var plugin_id = plugin_et._root.attrib['id']
      , i = 0
      // look for assets in the plugin 
      , assets = plugin_et.findall('./asset')
      , platformTag = plugin_et.find('./platform[@name="android"]')
      , libFiles = platformTag.findall('./library-file')
      , xmlGrafts = platformTag.findall('./xml-graft')
      , project_www_dir = path.join(project_dir, 'www', plugin_id)
      , dest_plugin_dir = path.join(project_dir, 'platforms', 'android', 'src');

    // fail if the package is already installed
    if (action === 'install' && platform_helpers.pluginInstalled(project_dir, plugin_id)) {
        throw new Error('plugin ' + plugin_id + ' is already installed');
    }

    // TODO: hoist error checking to fail before making changes needing undo

    xmlGrafts.forEach(function (tag) {
        var xpath_selector = tag.attrib['xpath']
          , file = tag.attrib['file']
          , full_path = path.join(project_dir, 'platforms', 'android', file)
          , children = tag.findall('*')
          , xml_doc = null;

        // verify file exists
        if(fs.existsSync(full_path))
        {
            // load into xml, then graft that motherfucker and save it!
            xml_doc = xml_helpers.parseElementtreeSync(full_path);
            if (action === 'install') {
                // the install action grafts a new node onto the XML tree
                xml_helpers.graftXML(xml_doc, children, xpath_selector);
            } else {
                // reverse the install action (prune the node from the XML tree)
                xml_helpers.pruneXML(xml_doc, children, xpath_selector);
            }
            // save the modified XMl back to storage
            output = xml_doc.write({indent: 4});
            output = output.replace(/\$PACKAGE_NAME/g, plugin_id);
            fs.writeFileSync(full_path, output, 'utf8');
        }
    });

    // TODO: which plugins have a library-file tag? I haven't seen any

    if (action === 'install') {
        // copy all of the native and www assets from the plugin into the project
        platform_helpers.copyFiles('android', plugin_dir, project_www_dir, dest_plugin_dir);
    } else {
        // use package name to determine path to the native android resources
        // example: com.alunny.foo would resolve to platforms/android/src/com/alunny/foo/
        var pieces = plugin_id.split('.');
        var to_remove = dest_plugin_dir;
        for(var j=0;j < pieces.length;j++) {
            to_remove = path.join(to_remove, pieces[j]);
        }
        platform_helpers.removeFiles(project_www_dir, to_remove);
    }
}

function srcPath(pluginPath, filename) {
    var prefix = /^src\/android/;

    if (prefix.test(filename)) {
        return path.resolve(pluginPath, filename);
    } else {
        return path.resolve(pluginPath, 'src/android', filename);
    }
}

// reads the package name out of the Android Manifest file
// @param string project_dir the absolute path to the directory containing the project
// @return string the name of the package
function androidPackageName(project_dir) {
  if (!fs.existsSync(path.resolve(project_dir, 'platforms', 'android', 'AndroidManifest.xml'))) {
    throw new Error(project_dir + " isn't a project directory. AndroidManifest.xml not found.");
  }
  var mDoc = xml_helpers.parseElementtreeSync(path.resolve(project_dir, 'platforms', 'android', 'AndroidManifest.xml'));
  return mDoc._root.attrib['package'];
}
