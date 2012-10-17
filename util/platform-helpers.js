/**
 * contains utility functions, used in iOS and Android
 */

var path = require('path')
  , fs = require(path.join(__dirname, 'fs'))  // use existsSync in 0.6.x
  , shell = require('shelljs')
  , glob = require('glob');

/**
 * copy all of the plugin files into the platform and www directories
 *
 * @param string platform enumeration    ios | android
 * @param path src_plugin_dir contains all files in the plugin archive
 * @param path dest_www_dir where the plugin can put www assets
 * @param path dest_plugin_dir where the plugin puts it's native files  
 */
exports.copyFiles = function(platform, src_plugin_dir, dest_www_dir, dest_plugin_dir) {
  if (!fs.existsSync(dest_plugin_dir)) {
    shell.mkdir('-p', dest_plugin_dir);
  }

  // copy native code to the plugin's native directory within the platform
  shell.cp('-R', path.join(src_plugin_dir, 'native', platform, '*'), dest_plugin_dir);

  if (!fs.existsSync(dest_www_dir)) {
    shell.mkdir('-p', dest_www_dir);
  }

  // copy www assets to the project's www directory
  shell.cp('-R', path.join(src_plugin_dir, 'www', '*'), dest_www_dir);
}

/**
 * determine if a plugin is installed already
 * @param path project_dir top level directory in the project
 * @param string plugin_id e.g., com.phonegap.myplugin
 * @return boolean true if installed, false otherwise
 */
exports.pluginInstalled = function(project_dir, plugin_id) {
  // very simple check; if any files exist that contain the plugin_id in
  // it's path, assume the plugin is installed
  var matching_files = glob.sync(project_dir + '/**/' + plugin_id);
  return (matching_files.length > 0);
}

/**
 * remove all of the files for a plugin
 */
exports.removeFiles = function(dest_www_dir, dest_plugin_dir) {
  shell.rm('-rf', dest_www_dir);
  shell.rm('-rf', dest_plugin_dir);
}
