/*!
 * ne.render v0.0.1 (https://nelabs.cn/nesite)
 * Copyright 2018 ethan.gor
 * Licensed under the MIT license
 */

(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

window.neRender = require('./index');
},{"./index":2}],2:[function(require,module,exports){
/****************************************************************** 
 * @render
 * Description: living dom 模板渲染引擎
 *******************************************************************/
var render = require('./lib/render');
var vtpl = require('./lib/vtpl');

module.exports = render.render;
module.exports.compile = render.compile;
module.exports.vtpl = vtpl;
},{"./lib/render":5,"./lib/vtpl":14}],3:[function(require,module,exports){

//compiler:AST=>Render

var _ = require('./util');

function compileAttrs(attrs, container) {
    var code = '';
    code += 'var ' + container + '=[];';
    attrs.forEach(function (attr, i) {
        var name = attr.name;
        var value = '';
        if (attr.value.tag == 'expression') {
            value = attr.value.metas;
        } else {
            value = '"' + attr.value + '"';
        }
        code += container + '.push({name:"' + name + '",value:' + value + '});';
    });
    return code;
}

function compileNode(node, container, index) {
    var code = '';
    var attrsContainer = container + '_' + index + '_attrs';
    var childrenContainer = container + '_' + index + '_children';
    code += compileAttrs(node.attrs, attrsContainer);
    code += compileNodes(node.children, childrenContainer, true);
    code += container + '.push({tag:"' + node.tag + '",attrs:' + attrsContainer + ',children:' +
        childrenContainer +
        '});';
    return code;
}

function compileNodes(nodes, container, flag) {
    var code = '';
    if (flag) {
        code += 'var ' + container + ' = [];';
    }
    nodes.forEach(function (node, i) {
        if (node.type == 'js') {
            if (node.tag == 'each') {
                code += ' for (var ' + node.metas.index + ' in ' + node.metas.collection + ') {'
                code += 'var ' + node.metas.item + '=' + node.metas.collection + '[' + node.metas.index + '];';
                code += compileNodes(node.children, container);
                code += '};';
            } else if (node.tag == 'if' || (node.tag == 'else' && node.metas.expression)) {
                code += 'if (' + node.metas.expression + ') {';
                code += compileNodes(node.children, container);
                code += '}';
                if (node.alternate) {
                    code += 'else{';
                    code += compileNodes(node.alternate, container);
                    code += '}';
                }
            } else if (node.tag == 'else') {
                code += compileNodes(node.children, container);
            } else {
                code += container + '.push(' + node.metas + ');';
            }
        } else if (node.type == 'element') {
            code += compileNode(node, container, i);
        } else {
            code += container + '.push("' + node + '");';
        }
    });
    return code;
}

function compiler(AST) {
    AST = _.isArray(AST) ? AST : [AST];
    var code = '';
    code += compileNodes(AST, 'ns');
    code = 'var ns=[];with(__data){' + code + '}return ns;';
    code = new Function('__data', code);
    return code;
}

//exports
module.exports = compiler;
},{"./util":7}],4:[function(require,module,exports){

//parser:Tpl=>AST

var _ = require('./util');

function isSelfClosingTAG(tag) {
    var selfClosingTAGs = ['br', 'hr', 'img', 'input', 'link', 'meta', 'base', 'param', 'area', 'col',
        'command', 'embed', 'keygen', 'source', 'track', 'wbr'
    ];
    return selfClosingTAGs.indexOf(tag) === 0;
}

function parseJST(line) {
    var node = {
        type: 'js',
        tag: '',
        metas: {},
        children: []
    };
    var reg = /([^="\s\/]+)\s?(.+)?/g;
    var reg_each = /(.+)\sas\s(.+)\s(.+)$/g;
    var reg_if = /([^="\s\/]+)\s?(.+)?/g;
    var match = reg.exec(line);
    if (match && ['each', 'if', 'else'].indexOf(match[1]) != -1) {
        node.tag = match[1];
        switch (node.tag) {
            case 'if':
                node.metas.expression = match[2];
                break;
            case 'each':
                match = reg_each.exec(match[2]);
                node.metas.collection = match[1];
                node.metas.item = match[2];
                node.metas.index = match[3];
                break;
            case 'else':
                if (match[2] && match[2].length > 0) {
                    match = reg_if.exec(match[2]);
                    node.metas.expression = match[2];
                }
                break;
        }
    } else {
        node.tag = 'expression';
        node.metas = line;
    }
    return node;
}

function parseTAG(line) {
    var node = {
        type: 'element',
        tag: '',
        attrs: [],
        children: []
    };
    var firstBlankIndex = line.indexOf(' ');
    if (firstBlankIndex != -1) {
        node.tag = line.slice(0, firstBlankIndex).trim();
        line = line.slice(firstBlankIndex).trim();
        node.attrs = parseAttributes(line);
    } else {
        node.tag = line;
    }
    return node;
}

function parseAttrValue(text) {
    var reg_jst = /{([^}]+)}/g;
    var cursor_jst = 0;
    var match_jst;
    var res;
    while (match_jst = reg_jst.exec(text)) {
        var t = text.slice(cursor_jst, match_jst.index);
        var line_jst = match_jst[1];
        var node = parseJST(line_jst);
        var metas = node.metas;
        if (!res) {
            res = node;
            res.metas = '';
        }
        res.metas += res.metas.length > 0 ? '+' : '';
        res.metas += t.length > 0 ? "'" + t + "'" : '';
        res.metas += res.metas.length > 0 ? '+' : '';
        res.metas += metas;
        cursor_jst = match_jst.index + match_jst[0].length;
    }
    text = text.slice(cursor_jst);
    if (text.length > 0) {
        if (!res) {
            res = text;
        } else {
            res.metas += "+'" + text + "'";
        }
    }
    return res;
}

function parseAttributes(line) {
    var attrs = [];
    var reg = /([^="\s\/]+)((="([^"]+)")|(='([^']+)'))?/g;
    var match;
    while (match = reg.exec(line)) {
        var value = match[4] || match[6] || match[1];
        value = parseAttrValue(value);
        var attr = {
            type: 'attribute',
            name: match[1],
            value: value
        };
        attrs.push(attr);
    }
    return attrs;
}

function parseTpl(tpl) {
    var AST = [];
    var stack = [];
    stack.push(AST);

    var reg_tag = /<([^>]+)>/g;
    var cursor = 0;
    var match_tag = null;
    //parseTAG
    while (match_tag = reg_tag.exec(tpl)) {
        //parseJST
        var text = tpl.slice(cursor, match_tag.index).trim();
        if (text.length > 0) {
            var reg_jst = /{([^}]+)}/g;
            var cursor_jst = 0;
            var match_jst;
            while (match_jst = reg_jst.exec(text)) {
                var t = text.slice(cursor_jst, match_jst.index).trim();
                if (t.length > 0) {
                    var root = stack[stack.length - 1].children || stack[stack.length - 1];
                    root.push(t);
                }
                var line_jst = match_jst[1];
                if (line_jst.slice(0, 1) != "/") {
                    var node = parseJST(line_jst);
                    if (node.tag == 'else') {
                        var root = stack[stack.length - 1];
                        root.alternate = root.alternate || [];
                        root.alternate.push(node);
                    } else {
                        var root = stack[stack.length - 1].children || stack[stack.length - 1];
                        root.push(node);
                    }
                    if (node.tag != 'expression') {
                        stack.push(node);
                    }
                } else {
                    var root = stack.pop();
                    if (line_jst.slice(1) == 'if') {
                        while (root.tag != 'if') {
                            root = stack.pop();
                        }
                    }
                }
                cursor_jst = match_jst.index + match_jst[0].length;
            }
            text = text.slice(cursor_jst);
            if (text.length > 0) {
                var root = stack[stack.length - 1].children || stack[stack.length - 1];
                root.push(text);
            }
        }
        //
        var root = stack[stack.length - 1].children || stack[stack.length - 1];
        var line_tag = match_tag[1];
        if (line_tag.slice(0, 1) != "/") {
            var node = parseTAG(line_tag);
            root.push(node);
            if (!isSelfClosingTAG(node.tag)) {
                stack.push(node);
            }
        } else {
            stack.pop();
        }
        cursor = match_tag.index + match_tag[0].length;
    }
    return AST;
}

function parser(tpl) {
    var AST = parseTpl(tpl);
    AST = AST.length == 1 ? AST[0] : AST;
    return AST;
}

//exports
module.exports = parser;
},{"./util":7}],5:[function(require,module,exports){
var parser = require('./parser'),
    compiler = require('./compiler'),
    toDom = require('./todom');

function compile(tpl) {
    var AST = parser(tpl);
    var _render = compiler(AST);
    return function (data) {
        return toDom(_render(data));
    }
}

function render(tpl, data, container) {
    var el = compile(tpl)(data);
    container && container.appendChild(el);
    return el;
}

//exports
module.exports.compile = compile;
module.exports.render=render;
},{"./compiler":3,"./parser":4,"./todom":6}],6:[function(require,module,exports){
var _ = require('./util');

//Covert
//covert:node => DOM Element
function toElement(node) {
    var el = document.createElement(node.tag);
    node.attrs.forEach(function (attr) {
        if (_.isFunction(attr.value)) {
            el[attr.name] = attr.value;
        } else {
            attr.value && el.setAttribute(attr.name, attr.value);
        }
    });
    node.children.forEach(function (child) {
        if (!child.tag) {
            child = document.createTextNode(child);
        } else {
            child = toElement(child);
        }
        el.appendChild(child);
    });
    return el;
}

//covert:nodelist => DOM Fragment
function toElements(nodelist) {
    var fragment = document.createDocumentFragment();
    nodelist.forEach(function (node) {
        fragment.appendChild(toElement(node));
    });
    return fragment;
}

function toDom(node) {
    node = _.isArray(node) && node.length == 1 ? node[0] : node;
    var dom = _.isArray(node) ? toElements(node) : toElement(node);
    return dom;
}

//exports
module.exports=toDom;
},{"./util":7}],7:[function(require,module,exports){
(function (process){
var _ = {}

//Util
_.type = function (obj) {
  return Object.prototype.toString.call(obj).replace(/\[object\s|\]/g, '')
}

_.isString = function isString (list) {
  return _.type(list) === 'String'
}

_.isArray = function (obj) {
    return Object.prototype.toString.call(obj) === '[object Array]';
}

_.isObject = function (obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
}

_.isFunction = function (obj) {
    return typeof obj == 'function' || false;
}

_.each = function each (array, fn) {
  for (var i = 0, len = array.length; i < len; i++) {
    fn(array[i], i)
  }
}

_.toArray = function toArray (listLike) {
  if (!listLike) {
    return []
  }

  var list = []

  for (var i = 0, len = listLike.length; i < len; i++) {
    list.push(listLike[i])
  }

  return list
}

_.setAttr = function setAttr (node, key, value) {
  switch (key) {
    case 'style':
      node.style.cssText = value
      break
    case 'value':
      var tagName = node.tagName || ''
      tagName = tagName.toLowerCase()
      if (
        tagName === 'input' || tagName === 'textarea'
      ) {
        node.value = value
      } else {
        // if it is not a input or textarea, use `setAttribute` to set
        node.setAttribute(key, value)
      }
      break
    default:
      node.setAttribute(key, value)
      break
  }
}

_.extend = function (dest, src) {
    for (var key in src) {
      if (src.hasOwnProperty(key)) {
        dest[key] = src[key]
      }
    }
    return dest
  }
  
  if (process.env.NODE_ENV) {
    _.nextTick = process.nextTick
  } else {
    var nextTick = window.requestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      window.oRequestAnimationFrame ||
      window.msRequestAnimationFrame
  
    if (nextTick) {
      _.nextTick = function () {
        nextTick.apply(window, arguments)
      }
    } else {
      _.nextTick = function (func) {
        // for IE, setTimeout is a cool object instead of function
        // so you cannot simply use nextTick.apply
        setTimeout(func)
      }
    }
  }  

//exports
module.exports = _;
}).call(this,require('_process'))
},{"_process":15}],8:[function(require,module,exports){
var _ = require('../util')
var patch = require('./patch')
var listDiff = require('./listDiff').diff

function diff (oldTree, newTree) {
  var index = 0
  var patches = {}
  dfsWalk(oldTree, newTree, index, patches)
  return patches
}

function dfsWalk (oldNode, newNode, index, patches) {
  var currentPatch = []

  // Node is removed.
  if (newNode === null) {
    // Real DOM node will be removed when perform reordering, so has no needs to do anthings in here
  // TextNode content replacing
  } else if (_.isString(oldNode) && _.isString(newNode)) {
    if (newNode !== oldNode) {
      currentPatch.push({ type: patch.TEXT, content: newNode })
    }
  // Nodes are the same, diff old node's props and children
  } else if (
      oldNode.tagName === newNode.tagName &&
      oldNode.key === newNode.key
    ) {
    // Diff props
    var propsPatches = diffProps(oldNode, newNode)
    if (propsPatches) {
      currentPatch.push({ type: patch.PROPS, props: propsPatches })
    }
    // Diff children. If the node has a `ignore` property, do not diff children
    if (!isIgnoreChildren(newNode)) {
      diffChildren(
        oldNode.children,
        newNode.children,
        index,
        patches,
        currentPatch
      )
    }
  // Nodes are not the same, replace the old node with new node
  } else {
    currentPatch.push({ type: patch.REPLACE, node: newNode })
  }

  if (currentPatch.length) {
    patches[index] = currentPatch
  }
}

function diffChildren (oldChildren, newChildren, index, patches, currentPatch) {
  var diffs = listDiff(oldChildren, newChildren, 'key')
  newChildren = diffs.children

  if (diffs.moves.length) {
    var reorderPatch = { type: patch.REORDER, moves: diffs.moves }
    currentPatch.push(reorderPatch)
  }

  var leftNode = null
  var currentNodeIndex = index
  _.each(oldChildren, function (child, i) {
    var newChild = newChildren[i]
    currentNodeIndex = (leftNode && leftNode.count)
      ? currentNodeIndex + leftNode.count + 1
      : currentNodeIndex + 1
    dfsWalk(child, newChild, currentNodeIndex, patches)
    leftNode = child
  })
}

function diffProps (oldNode, newNode) {
  var count = 0
  var oldProps = oldNode.props
  var newProps = newNode.props

  var key, value
  var propsPatches = {}

  // Find out different properties
  for (key in oldProps) {
    value = oldProps[key]
    if (newProps[key] !== value) {
      count++
      propsPatches[key] = newProps[key]
    }
  }

  // Find out new property
  for (key in newProps) {
    value = newProps[key]
    if (!oldProps.hasOwnProperty(key)) {
      count++
      propsPatches[key] = newProps[key]
    }
  }

  // If properties all are identical
  if (count === 0) {
    return null
  }

  return propsPatches
}

function isIgnoreChildren (node) {
  return (node.props && node.props.hasOwnProperty('ignore'))
}

module.exports = diff

},{"../util":7,"./listDiff":10,"./patch":11}],9:[function(require,module,exports){
var _ = require('../util')

/**
 * Virtual-dom Element.
 * @param {String} tagName
 * @param {Object} props - Element's properties,
 *                       - using object to store key-value pair
 * @param {Array<Element|String>} - This element's children elements.
 *                                - Can be Element instance or just a piece plain text.
 */
function Element (tagName, props, children) {
  if (!(this instanceof Element)) {
    return new Element(tagName, props, children)
  }

  if (_.isArray(props)) {
    children = props
    props = {}
  }

  this.tagName = tagName
  this.props = props || {}
  this.children = children || []
  this.key = props
    ? props.key
    : void 666

  var count = 0

  _.each(this.children, function (child, i) {
    if (child instanceof Element) {
      count += child.count
    } else {
      children[i] = '' + child
    }
    count++
  })

  this.count = count
}

/**
 * Render the hold element tree.
 */
Element.prototype.render = function () {
  var el = document.createElement(this.tagName)
  var props = this.props

  for (var propName in props) {
    var propValue = props[propName]
    _.setAttr(el, propName, propValue)
  }

  _.each(this.children, function (child) {
    var childEl = (child instanceof Element)
      ? child.render()
      : document.createTextNode(child)
    el.appendChild(childEl)
  })

  return el
}

module.exports = Element

},{"../util":7}],10:[function(require,module,exports){
/**
 * Diff two list in O(N).
 * @param {Array} oldList - Original List
 * @param {Array} newList - List After certain insertions, removes, or moves
 * @return {Object} - {moves: <Array>}
 *                  - moves is a list of actions that telling how to remove and insert
 */
function diff (oldList, newList, key) {
  var oldMap = makeKeyIndexAndFree(oldList, key)
  var newMap = makeKeyIndexAndFree(newList, key)

  var newFree = newMap.free

  var oldKeyIndex = oldMap.keyIndex
  var newKeyIndex = newMap.keyIndex

  var moves = []

  // a simulate list to manipulate
  var children = []
  var i = 0
  var item
  var itemKey
  var freeIndex = 0

  // fist pass to check item in old list: if it's removed or not
  while (i < oldList.length) {
    item = oldList[i]
    itemKey = getItemKey(item, key)
    if (itemKey) {
      if (!newKeyIndex.hasOwnProperty(itemKey)) {
        children.push(null)
      } else {
        var newItemIndex = newKeyIndex[itemKey]
        children.push(newList[newItemIndex])
      }
    } else {
      var freeItem = newFree[freeIndex++]
      children.push(freeItem || null)
    }
    i++
  }

  var simulateList = children.slice(0)

  // remove items no longer exist
  i = 0
  while (i < simulateList.length) {
    if (simulateList[i] === null) {
      remove(i)
      removeSimulate(i)
    } else {
      i++
    }
  }

  // i is cursor pointing to a item in new list
  // j is cursor pointing to a item in simulateList
  var j = i = 0
  while (i < newList.length) {
    item = newList[i]
    itemKey = getItemKey(item, key)

    var simulateItem = simulateList[j]
    var simulateItemKey = getItemKey(simulateItem, key)

    if (simulateItem) {
      if (itemKey === simulateItemKey) {
        j++
      } else {
        // new item, just inesrt it
        if (!oldKeyIndex.hasOwnProperty(itemKey)) {
          insert(i, item)
        } else {
          // if remove current simulateItem make item in right place
          // then just remove it
          var nextItemKey = getItemKey(simulateList[j + 1], key)
          if (nextItemKey === itemKey) {
            remove(i)
            removeSimulate(j)
            j++ // after removing, current j is right, just jump to next one
          } else {
            // else insert item
            insert(i, item)
          }
        }
      }
    } else {
      insert(i, item)
    }

    i++
  }

  function remove (index) {
    var move = {index: index, type: 0}
    moves.push(move)
  }

  function insert (index, item) {
    var move = {index: index, item: item, type: 1}
    moves.push(move)
  }

  function removeSimulate (index) {
    simulateList.splice(index, 1)
  }

  return {
    moves: moves,
    children: children
  }
}

/**
 * Convert list to key-item keyIndex object.
 * @param {Array} list
 * @param {String|Function} key
 */
function makeKeyIndexAndFree (list, key) {
  var keyIndex = {}
  var free = []
  for (var i = 0, len = list.length; i < len; i++) {
    var item = list[i]
    var itemKey = getItemKey(item, key)
    if (itemKey) {
      keyIndex[itemKey] = i
    } else {
      free.push(item)
    }
  }
  return {
    keyIndex: keyIndex,
    free: free
  }
}

function getItemKey (item, key) {
  if (!item || !key) return void 666
  return typeof key === 'string'
    ? item[key]
    : key(item)
}

exports.makeKeyIndexAndFree = makeKeyIndexAndFree // exports for test
exports.diff = diff

},{}],11:[function(require,module,exports){
var _ = require('../util')

var REPLACE = 0
var REORDER = 1
var PROPS = 2
var TEXT = 3

function patch (node, patches) {
  var walker = {index: 0}
  dfsWalk(node, walker, patches)
}

function dfsWalk (node, walker, patches) {
  var currentPatches = patches[walker.index]

  var len = node.childNodes
    ? node.childNodes.length
    : 0
  for (var i = 0; i < len; i++) {
    var child = node.childNodes[i]
    walker.index++
    dfsWalk(child, walker, patches)
  }

  if (currentPatches) {
    applyPatches(node, currentPatches)
  }
}

function applyPatches (node, currentPatches) {
  _.each(currentPatches, function (currentPatch) {
    switch (currentPatch.type) {
      case REPLACE:
        var newNode = (typeof currentPatch.node === 'string')
          ? document.createTextNode(currentPatch.node)
          : currentPatch.node.render()
        node.parentNode.replaceChild(newNode, node)
        break
      case REORDER:
        reorderChildren(node, currentPatch.moves)
        break
      case PROPS:
        setProps(node, currentPatch.props)
        break
      case TEXT:
        if (node.textContent) {
          node.textContent = currentPatch.content
        } else {
          // fuck ie
          node.nodeValue = currentPatch.content
        }
        break
      default:
        throw new Error('Unknown patch type ' + currentPatch.type)
    }
  })
}

function setProps (node, props) {
  for (var key in props) {
    if (props[key] === void 666) {
      node.removeAttribute(key)
    } else {
      var value = props[key]
      _.setAttr(node, key, value)
    }
  }
}

function reorderChildren (node, moves) {
  var staticNodeList = _.toArray(node.childNodes)
  var maps = {}

  _.each(staticNodeList, function (node) {
    if (node.nodeType === 1) {
      var key = node.getAttribute('key')
      if (key) {
        maps[key] = node
      }
    }
  })

  _.each(moves, function (move) {
    var index = move.index
    if (move.type === 0) { // remove item
      if (staticNodeList[index] === node.childNodes[index]) { // maybe have been removed for inserting
        node.removeChild(node.childNodes[index])
      }
      staticNodeList.splice(index, 1)
    } else if (move.type === 1) { // insert item
      var insertNode = maps[move.item.key]
        ? maps[move.item.key] // reuse old item
        : (typeof move.item === 'object')
            ? move.item.render()
            : document.createTextNode(move.item)
      staticNodeList.splice(index, 0, insertNode)
      node.insertBefore(insertNode, node.childNodes[index] || null)
    }
  })
}

patch.REPLACE = REPLACE
patch.REORDER = REORDER
patch.PROPS = PROPS
patch.TEXT = TEXT

module.exports = patch

},{"../util":7}],12:[function(require,module,exports){
module.exports.el = require('./element')
module.exports.diff = require('./diff')
module.exports.patch = require('./patch')

},{"./diff":8,"./element":9,"./patch":11}],13:[function(require,module,exports){
var _ = require('./util');
var svd = require('./virtual-dom/virtual-dom');
var toDom = require('./todom');
var diff = svd.diff;
var patch = svd.patch;


function makeTemplateClass (compileFn) {
  function VirtualTemplate (data) {
    this.data = data;
    var domAndVdom = this.makeVirtualDOM();
    this.vdom = domAndVdom.vdom;
    this.dom = domAndVdom.dom;
    this.isDirty = false;
    this.flushCallbacks = [];
  }

  _.extend(VirtualTemplate.prototype, {
    compileFn: compileFn,
    setData: setData,
    makeVirtualDOM: makeVirtualDOM,
    flush: flush
  });

  return VirtualTemplate;
}

function setData(data, isSync) {
  _.extend(this.data, data);
  if (typeof isSync === 'boolean' && isSync) {
    this.flush();
  } else if (!this.isDirty) {
    this.isDirty = true;
    var self = this;
    // cache all data change, and only refresh dom before browser's repainting
    _.nextTick(function () {
      self.flush();
    });
  }
  if (typeof isSync === 'function') {
    var callback = isSync;
    this.flushCallbacks.push(callback);
  }
}

function flush() {
  // run virtual-dom algorithm
  var newVdom = this.makeVirtualDOM().vdom;
  var patches = diff(this.vdom, newVdom);
  patch(this.dom, patches);
  this.vdom = newVdom;
  this.isDirty = false;
  var callbacks = this.flushCallbacks;
  for (var i = 0, len = callbacks.length; i < len; i++) {
    if (callbacks[i]) {
      callbacks[i]();
    }
  }
  this.flushCallbacks = [];
}

function makeVirtualDOM() {
  var node = this.compileFn(this.data);
  if(_.isArray(node)){
    node={
      tag:'div',
      attrs:[],
      children:node
    }
  }
  return {
    dom:toDom(node),
    vdom:toVirtualDOM(node)
  }
}

function toVirtualDOM(node) {
  var tagName = node.tag.toLowerCase();
  var props ={};
  var children = [];
  node.attrs.forEach(function(a,i){
    if(a.value){
      props[a.name]=a.value;
    }
  });
  node.children.forEach(function (c, i) {
    if(c.tag){
      children.push(toVirtualDOM(c));
    }else{
      children.push(c);
    }
  });
  return svd.el(tagName, props, children);
}

module.exports = function (compileFn) {
  return  makeTemplateClass(compileFn);
}
},{"./todom":6,"./util":7,"./virtual-dom/virtual-dom":12}],14:[function(require,module,exports){
var parser = require('./parser'),
    compiler = require('./compiler'),
    vTemplate=require('./virtual-template');

function vtpl(tpl){
    var AST = parser(tpl);
    var _render = compiler(AST);
    return vTemplate(_render);
}

//exports
module.exports=vtpl;
},{"./compiler":3,"./parser":4,"./virtual-template":13}],15:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[1]);
