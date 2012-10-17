var fs = require('fs')
  , path = require('path')
  , plist = require('plist')
  , xcode = require('xcode')
  , osenv = require('osenv')
  , shell = require('shelljs')
  , et = require('elementtree')
  , ios = require(path.join(__dirname, '..', 'platforms', 'ios'))

  , test_dir = path.join(osenv.tmpdir(), 'test_pluginstall')
  , test_project_dir = path.join(test_dir, 'projects', 'testproj')
  , test_plugin_dir = path.join(test_dir, 'plugins', 'ChildBrowser')
  , xml_path     = path.join(test_dir, 'plugins', 'ChildBrowser', 'plugin.xml')
  , xml_text, plugin_et, plugin_id

  //, assetsDir = path.resolve(config.projectPath, 'www')
  , srcDir = path.resolve(test_project_dir, 'SampleApp/Plugins')
  , resDir = path.resolve(test_project_dir, 'SampleApp/Resources');

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

exports['should remove the js file'] = function (test) {
    // run the platform-specific function
    ios.handlePlugin('install', test_project_dir, test_plugin_dir, plugin_et);
    ios.handlePlugin('uninstall', test_project_dir, test_plugin_dir, plugin_et);

    var jsPath = path.join(test_dir, 'projects', 'testproj', 'platforms', 'www', plugin_id, 'childbrowser.js');
    test.ok(!fs.existsSync(jsPath))
    test.done();
}

exports['should remove the source files'] = function (test) {
    // run the platform-specific function
    ios.handlePlugin('install', test_project_dir, test_plugin_dir, plugin_et);
    ios.handlePlugin('uninstall', test_project_dir, test_plugin_dir, plugin_et);

    var pluginPath = path.join(test_dir, 'projects', 'testproj', 'platforms', 'ios', 'HelloCordova', 'Plugins', plugin_id);
    test.ok(!fs.existsSync(path.join(pluginPath, 'ChildBrowserCommand.m')));
    test.ok(!fs.existsSync(path.join(pluginPath, 'ChildBrowserViewController.m')));
    test.ok(!fs.existsSync(path.join(pluginPath, 'preserveDirs/PreserveDirsTest.m')));

    test.done();
}

exports['should remove the header files'] = function (test) {
    // run the platform-specific function
    ios.handlePlugin('install', test_project_dir, test_plugin_dir, plugin_et);
    ios.handlePlugin('uninstall', test_project_dir, test_plugin_dir, plugin_et);

    var pluginPath = path.join(test_dir, 'projects', 'testproj', 'platforms', 'ios', 'HelloCordova', 'Plugins', plugin_id);
    test.ok(!fs.existsSync(path.join(pluginPath, 'ChildBrowserCommand.h')));
    test.ok(!fs.existsSync(path.join(pluginPath, 'ChildBrowserViewController.h')));
    test.ok(!fs.existsSync(path.join(pluginPath, 'preserveDirs/PreserveDirsTest.h')));

    test.done();
}

exports['should remove the xib file'] = function (test) {
    // run the platform-specific function
    ios.handlePlugin('install', test_project_dir, test_plugin_dir, plugin_et);
    ios.handlePlugin('uninstall', test_project_dir, test_plugin_dir, plugin_et);

    var pluginPath = path.join(test_dir, 'projects', 'testproj', 'platforms', 'ios', 'HelloCordova', 'Plugins', plugin_id);
    test.ok(!fs.existsSync(path.join(pluginPath, 'ChildBrowserViewController.xib')));

    test.done();
}

exports['should remove the bundle'] = function (test) {
    // run the platform-specific function
    ios.handlePlugin('install', test_project_dir, test_plugin_dir, plugin_et);
    ios.handlePlugin('uninstall', test_project_dir, test_plugin_dir, plugin_et);

    var bundlePath = path.join(test_dir, 'projects', 'testproj', 'platforms', 'ios', 'HelloCordova', 'Plugins', plugin_id, 'ChildBrowser.bundle');

    test.ok(!fs.existsSync(bundlePath));
    test.done();
}

exports['should edit PhoneGap.plist'] = function (test) {
    // run the platform-specific function
    ios.handlePlugin('install', test_project_dir, test_plugin_dir, plugin_et);
    ios.handlePlugin('uninstall', test_project_dir, test_plugin_dir, plugin_et);

    var plistPath = path.join(test_dir, 'projects', 'testproj', 'platforms', 'ios', 'HelloCordova', 'Cordova.plist');
    var obj = plist.parseFileSync(plistPath);

    test.notEqual(obj.Plugins['ChildBrowser'], 'ChildBrowserCommand');  

    // TODO: I think this was broken in the old tests. After uninstall shouldnt hosts be removed?
    test.equal(obj.ExternalHosts.length, 0);
    test.done();
}

exports['should edit the pbxproj file'] = function (test) {
    // run the platform-specific function
    ios.handlePlugin('install', test_project_dir, test_plugin_dir, plugin_et);
    ios.handlePlugin('uninstall', test_project_dir, test_plugin_dir, plugin_et);

    var projPath = path.join(test_dir, 'projects', 'testproj', 'platforms', 'ios', 'HelloCordova.xcodeproj', 'project.pbxproj');
    
    var obj = xcode.project(projPath).parseSync();

    var fileRefSection = obj.hash.project.objects['PBXFileReference'],
        fileRefLength = Object.keys(fileRefSection).length,
        EXPECTED_TOTAL_REFERENCES = 82; // magic number ahoy!

    test.equal(fileRefLength, EXPECTED_TOTAL_REFERENCES);

    test.done();
}

exports['should remove the framework references from the pbxproj file'] = function (test) {
    // run the platform-specific function
    ios.handlePlugin('install', test_project_dir, test_plugin_dir, plugin_et);
    ios.handlePlugin('uninstall', test_project_dir, test_plugin_dir, plugin_et);

    var projPath = path.join(test_dir, 'projects', 'testproj', 'platforms', 'ios', 'HelloCordova.xcodeproj', 'project.pbxproj')
      , projContents = fs.readFileSync(projPath, 'utf8')
      , projLines = projContents.split("\n")
      , references;

    references = projLines.filter(function (line) {
        return !!(line.match("libsqlite3.dylib"));
    })

    // should be four libsqlite3 reference lines added
    // pretty low-rent test eh
    test.equal(references.length, 0);
    test.done();
}
