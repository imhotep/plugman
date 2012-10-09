/**
 * contains XML utility functions, some of which are specific to elementtree
 */

var fs = require('fs')
  , path = require('path')
  , et = require('elementtree');

// compare two et.XML nodes, see if they match
// compares tagName, text, attributes and children (recursively)
exports.equalNodes = function(one, two) {
    if (one.tag != two.tag) {
        return false;
    } else if (one.text.trim() != two.text.trim()) {
        return false;
    } else if (one._children.length != two._children.length) {
        return false;
    }

    var oneAttribKeys = Object.keys(one.attrib),
        twoAttribKeys = Object.keys(two.attrib),
        i = 0, attribName;

    if (oneAttribKeys.length != twoAttribKeys.length) {
        return false;
    }

    for (i; i < oneAttribKeys.length; i++) {
        attribName = oneAttribKeys[i];

        if (one.attrib[attribName] != two.attrib[attribName]) {
            return false;
        }
    }

    for (i; i < one._children.length; i++) {
        if (!exports.equalNodes(one._children[i], two._children[i])) {
            return false;
        }
    }

    return true;
}

// adds node to doc at selector
exports.graftXML = function (doc, nodes, selector) {
    var ROOT = /^\/([^\/]*)/
      , ABSOLUTE = /^\/([^\/]*)\/(.*)/
      , parent, tagName, subSelector;

    // handle absolute selector (which elementtree doesn't like)
    if (ROOT.test(selector)) {
        tagName = selector.match(ROOT)[1];
        if (tagName === doc._root.tag) {
            parent = doc._root;

            // could be an absolute path, but not selecting the root
            if (ABSOLUTE.test(selector)) {
                subSelector = selector.match(ABSOLUTE)[2];
                parent = parent.find(subSelector)
            }
        } else {
            return false;
        }
    } else {
        parent = doc.find(selector)
    }

    nodes.forEach(function (node) {
        // check if child is unique first
        if (uniqueChild(node, parent)) {
            parent.append(node);
        }
    });

    return true;
}

// removes node from doc at selector
exports.pruneXML = function(doc, nodes, selector) {
    var ROOT = /^\/([^\/]*)/
      , ABSOLUTE = /^\/([^\/]*)\/(.*)/
      , parent, tagName, subSelector;

    // handle absolute selector (which elementtree doesn't like)
    if (ROOT.test(selector)) {
        tagName = selector.match(ROOT)[1];
        if (tagName === doc._root.tag) {
            parent = doc._root;

            // could be an absolute path, but not selecting the root
            if (ABSOLUTE.test(selector)) {
                subSelector = selector.match(ABSOLUTE)[2];
                parent = parent.find(subSelector)
            }
        } else {
            return false;
        }
    } else {
        parent = doc.find(selector)
    }
    nodes.forEach(function (node) {
        var matchingKid = null;
        if ((matchingKid = findChild(node, parent)) != null) {
            // stupid elementtree takes an index argument it doesn't use
            // and does not conform to the python lib
            parent.remove(0, matchingKid);
        }
    });

    return true;
}

exports.parseElementtreeSync = function (filename) {
    var contents = fs.readFileSync(filename, 'utf-8');
    return new et.ElementTree(et.XML(contents));
}


function findChild(node, parent) {
    var matchingKids = parent.findall(node.tag)
      , i, j;

    for (i = 0, j = matchingKids.length ; i < j ; i++) {
        if (exports.equalNodes(node, matchingKids[i])) {
            return matchingKids[i];
        }
    }
    return null;
}

function uniqueChild(node, parent) {
    var matchingKids = parent.findall(node.tag)
      , i = 0;

    if (matchingKids.length == 0) {
        return true;
    } else  {
        for (i; i < matchingKids.length; i++) {
            if (exports.equalNodes(node, matchingKids[i])) {
                return false;
            }
        }
        return true;
    }
}

