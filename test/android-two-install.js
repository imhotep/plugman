// Test installation on Cordova 2 project

var fs = require('fs')
  , path = require('path')
  , plist = require('plist')
  , xcode = require('xcode')
  , osenv = require('osenv')
  , shell = require('shelljs')
  , et = require('elementtree')
  , android = require(path.join(__dirname, '..', 'platforms', 'android'))

  , test_dir = path.join(osenv.tmpdir(), 'test_pluginstall')
  , test_project_dir = path.join(test_dir, 'projects', 'testproj')
  , test_plugin_dir = path.join(test_dir, 'plugins', 'ChildBrowser')
  , xml_path     = path.join(test_dir, 'plugins', 'ChildBrowser', 'plugin.xml')
  , xml_text, plugin_et, plugin_id;

exports.setUp = function(callback) {
    shell.mkdir('-p', test_dir);
    
    // copy the ios test project to a temp directory
    shell.cp('-r', path.join(__dirname, 'projects'), test_dir);

    // copy the ios test plugin to a temp directory
    shell.cp('-r', path.join(__dirname, 'plugins'), test_dir);

    // parse the plugin.xml into an elementtree object
    xml_text   = fs.readFileSync(xml_path, 'utf-8')
    plugin_et  = new et.ElementTree(et.XML(xml_text));
    plugin_id  = plugin_et._root.attrib['id'];

    callback();
}

exports.tearDown = function(callback) {
    // remove the temp files (projects and plugins)
    shell.rm('-rf', test_dir);
    callback();
}


exports['should move the js file'] = function (test) {
    
    android.handlePlugin('install', test_project_dir, test_plugin_dir, plugin_et);

    var jsPath = path.join(test_dir, 'projects', 'testproj', 'www', plugin_id, 'childbrowser.js');
    test.ok(fs.existsSync(jsPath));
    test.done();
}

exports['should move the directory'] = function (test) {
    android.handlePlugin('install', test_project_dir, test_plugin_dir, plugin_et);

    var assetPath = path.join(test_dir, 'projects', 'testproj', 'www', plugin_id);
    
    var assets = fs.statSync(assetPath);

    test.ok(assets.isDirectory());
    test.ok(fs.statSync(path.join(assetPath, 'icon_close.png')));
    test.done();
}

exports['should move the src file'] = function (test) {
    android.handlePlugin('install', test_project_dir, test_plugin_dir, plugin_et);

    var javaPath = path.join(test_dir, 'projects', 'testproj', 'platforms', 'android', 'src', 'com', 'phonegap', 'plugins', 'childBrowser', 'ChildBrowser.java');
    test.ok(fs.statSync(javaPath));
    test.done();
}

exports['should add ChildBrowser to config.xml'] = function (test) {
    android.handlePlugin('install', test_project_dir, test_plugin_dir, plugin_et);

    var pluginsXmlPath = path.join(test_dir, 'projects', 'testproj', 'platforms', 'android', 'res', 'xml', 'config.xml');
    var pluginsTxt = fs.readFileSync(pluginsXmlPath, 'utf-8'),
        pluginsDoc = new et.ElementTree(et.XML(pluginsTxt)),
        expected = 'plugins/plugin[@name="ChildBrowser"]' +
                    '[@value="com.phonegap.plugins.childBrowser.ChildBrowser"]';

    test.ok(pluginsDoc.find(expected));
    test.done();
}

exports['should add ChildBrowser to AndroidManifest.xml'] = function (test) {
    android.handlePlugin('install', test_project_dir, test_plugin_dir, plugin_et);

    var manifestPath = path.join(test_dir, 'projects', 'testproj', 'platforms', 'android', 'AndroidManifest.xml');
    var manifestTxt = fs.readFileSync(manifestPath, 'utf-8'),
        manifestDoc = new et.ElementTree(et.XML(manifestTxt)),
        activities = manifestDoc.findall('application/activity'), i;

    var found = false;
    for (i=0; i<activities.length; i++) {
        if ( activities[i].attrib['android:name'] === 'com.phonegap.plugins.childBrowser.ChildBrowser' ) {
            found = true;
            break;
        }
    }
    test.ok(found);
    test.done();
}
