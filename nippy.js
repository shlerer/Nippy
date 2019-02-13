'use strict';

var Nippy = function() {
	
	const COMMENT_NODE = 8;
	const ELEMENT_NODE = 1;
	const TEXT_NODE = 3;
	const DOCUMENT_FRAGMENT_NODE = 11;
	  
//	var cache = {};
	
	var cache = {
		stored: {},
		
		set: function(key, value) {
			cache.stored[key] = value;
		},
		
		get: function(key) {
			return cache.stored[key];
		},
		
		refresh: function() {
			cache.stored = {};
		}
	}

	var uuidv4 = function () {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});
	}
	
	var uuid = function (){
		var UID = '%' + Math.random().toFixed(6) + '%';
		return UID;
	}
	
	var htmlEncode = function (str) {
	    return str.replace(/[&<>"']/g, function($0) {
	        return "&" + {"&":"amp", "<":"lt", ">":"gt", '"':"quot", "'":"#39"}[$0] + ";";
	    });
	}
	
	var htmlDecode = function (html) {
		var txt = document.createElement('textarea');
		txt.innerHTML = html;
		return txt.value;
	};

	
	var cloneObj = function(obj) {
		if (Array.isArray(obj)) {
			return JSON.parse(JSON.stringify(obj));
		}
		if (typeof obj == 'object') {
			return Object.assign({}, obj);
		}
		return obj;
	}
	
	var createElement = function(markup) {
		var temp = document.createElement('div');
		temp.innerHTML = markup;
		
		var frag = document.createDocumentFragment();
		// Use childNodes to allow creating element nodes or text nodes:
		var children = Array.prototype.slice.apply(temp.childNodes);
		children.map(el => frag.appendChild(el));
		return frag;	
	}
	
	var getElmAttributes = function(elm) {
		var attrs = elm.attributes;
		var attributes = [];
		if (attrs) {
			var length = attrs.length;
			attributes = new Array(length);
			for (var i = 0; i < length; i++) {
				var attr = attrs[i];
				attributes[i] = {name: attr.nodeName, value: attr.nodeValue};
			}
		}
		return attributes;
	}
	
	var htmlTemplate = function(strings, ...values) {
		var templateObj = {};
		var templateStr = '';
		var uid		= uuid();
		
		strings.map(function(string, index){
			// Add Comment that will be helper for positions
			templateStr += string + ((index <= values.length - 1) ? '<!--top--><!--'+uid+'_'+index+'-->' : '');
		});

		templateObj.uid				= uid;
		templateObj.type 			= 'templateObj';
		templateObj.templateStr		= '<!--start-->'+templateStr+'<!--end-->';
		templateObj.strings			= strings;
		templateObj.values			= values;
		
		return templateObj; 
	}
	
	var html = function(strings, ...values) {
		var key = 'html_'+strings.join('');
		var templateObj = {};
		
		if (templateObj = cache.get(key)) {
			templateObj.values 	= values;
			cache.set(key, templateObj);
		}
		else if (!templateObj) {
			templateObj 	 	= htmlTemplate(strings, ...values);
			templateObj.key 	= key;
			cache.set(key, templateObj);
		}
		
		return cloneObj(templateObj); 
	}
	
	var collection = function(templateObjects) {
		templateObjects.forEach(function(templateObj, index){
			templateObj.type = 'htmlCollection';
			templateObj.key = templateObj.key+uuid(); // For Caching
		});
		return templateObjects;
	}
	
	var genNodeCallback = function(markup, refNode) {
		var callback = {};
		var callbackArray = [];
			
		if (Array.isArray(markup)) { // Array of values
			markup.forEach(function(_markup){
				var cb = {}
				if (typeof _markup == 'object' && _markup.type == 'htmlCollection') { // Array of htmlCollection
					var rootTemplateNode = createElement(_markup.templateStr);
					rootTemplateNode = render(_markup, rootTemplateNode);
					
					callback.type = 'htmlCollection'
					cb.newNode 	= rootTemplateNode;
					cb.refNode 	= refNode;
					cb.type		= 'htmlCollection';
					callbackArray.push(cb);
					
				}
				else if (typeof _markup == 'object' && _markup.type == 'templateObj') { // Array of templateobj values
					var rootTemplateNode = createElement(_markup.templateStr);
					rootTemplateNode = render(_markup, rootTemplateNode);
					
					cb.newNode 	= rootTemplateNode;
					cb.refNode 	= refNode;
					callbackArray.push(cb);
				}
				else { // Array of string values
					cb.newNode 	= createElement(_markup);
					cb.refNode 	= refNode;
					callbackArray.push(cb);
				}
			});
			
			callback.newNode = callbackArray;
		}
		else if (typeof markup == 'object' && markup.type == 'templateObj') { // Templateobj values
			var rootTemplateNode = createElement(markup.templateStr);
			rootTemplateNode = render(markup, rootTemplateNode);
			callback.newNode = rootTemplateNode;
		}
		else {
			callback.newNode = createElement(markup);
		}
		
		if (Object.keys(callback).length > 0) { // String values
			callback.type 		= callback.type ? callback.type : 'node';
			callback.refNode 	= refNode;
		}
		
		return callback;
	}
	

	var genAttrCallback = function(templateObj, refNode) {
		var callbacksArr = [];
		
		var attributes = getElmAttributes(refNode);
		let cacheValueKey 	= 'values_'+templateObj.key;
		let cacheValues;
		if (!(cacheValues = cache.get(cacheValueKey))) {
			cacheValues = [];
		}
		
		attributes.forEach(function(attr){
			var attrNname = attr.name;
			var type = 'attribute';
			var kind = 'attribute';
			
			if (attrNname.startsWith('data-nippy')) {
				attrNname = attr.name.split('data-nippy_')[1];
			}
			
			if (attrNname.startsWith('is:')) { // node attributes booloean
				attrNname = attr.name.split('is:')[1];
				kind = 'attribute-bool';
			}
			else if (attrNname.startsWith('prop:')) { // node properties binding
				attrNname = attr.name.split('prop:')[1];
				kind = 'attribute-node-prop';
			}
			else if (attrNname.startsWith('on:')) { // event handlers
				kind = 'attribute-event'
				attrNname = attr.name.split('on:')[1];
			}
			
			var commentsRegx = /<!--(.*?)-->/g;
			
			if (commentsRegx.test(attr.value)) {
				var m;
				var newValue = attr.value;
				
				commentsRegx.lastIndex = 0;
				while (m = commentsRegx.exec(attr.value)) {
					var markup;
					var index = m[1];
					index = parseInt(index.split(templateObj.uid+'_')[1]);
		    		
		    		if (cacheValues[index] !== templateObj.values[index]) {
		    			markup = templateObj.values[index];
		    		}
		    		else if (JSON.stringify(cacheValues[index]) !== JSON.stringify(templateObj.values[index])) {
		    			markup = templateObj.values[index];
		    		}
		    		
					if (typeof markup != 'undefined') {
						
						if (kind == 'attribute') {
							newValue = newValue.replace(m[0], markup);
						}
						else if (kind == 'attribute-bool') {
							markup = markup.toString();
							newValue = newValue.replace(m[0], markup);
						}
						else if (kind == 'attribute-node-prop') {
							newValue = markup;
						}
						else if (kind == 'attribute-event') {
							newValue = markup;
						}
						else {
							newValue = newValue.replace(m[0], markup);
						}
					}
				}
				
				if (typeof markup != 'undefined') {
					
					if (typeof newValue == 'string') {
						newValue = newValue.replace('<!--top-->', '');	
					}
					
					var callback = {
						type	: type,
						kind	: kind,
						refNode	: refNode,
						name	: attrNname,
						base	: attr.value,
						value	: newValue,
					}
					callbacksArr.push(callback);
				}
			}
		});
		
		return callbacksArr;
	}
	
	var generateTemplateCallbacks = function(templateObj, node, callbacks) {
		var childNodes = node.childNodes;
		var length = childNodes.length;
		var i = 0;

		while (i < length) {
			var child = childNodes[i];
			
			// Elements nodes
			if (child.nodeType == ELEMENT_NODE) {
				// Attributes
				var callbacksArr = genAttrCallback(templateObj, child);
				callbacksArr.forEach(function(callback){
					callbacks.push(callback);	
				});
				// Recursive call
				generateTemplateCallbacks(templateObj, child, callbacks)
			}
			// Comments nodes
			else if (child.nodeType == COMMENT_NODE) {
				if (child.nodeType == COMMENT_NODE) {
					let markup;
					let cacheValueKey 	= 'values_'+templateObj.key;
					let cacheValues;
					if (!(cacheValues = cache.get(cacheValueKey))) {
						cacheValues = [];
					}
					
		    		let index 			= parseInt(child.textContent.split(templateObj.uid+'_')[1]);
		    		
		    		if (cacheValues[index] !== templateObj.values[index]) {
		    			markup = templateObj.values[index];
		    		}
		    		else if (JSON.stringify(cacheValues[index]) !== JSON.stringify(templateObj.values[index])) {
		    			markup = templateObj.values[index];
		    		}
		    		
					if (typeof markup != 'undefined') {
						var callback = genNodeCallback(markup, child);
						if (Object.keys(callback).length > 0) {
							callbacks.push(callback);	
						}	
					}
				}		
			}
			// text nodes?
			else if (child.nodeType == TEXT_NODE) {
			}
	    	i++;
	    }
		
		return callbacks;
	}
	
	var removeCommentsBlock = function(commentNode) {
		if (!(commentNode.previousSibling.nodeType == COMMENT_NODE && commentNode.previousSibling.textContent == 'top')) {
			var prevNode = commentNode.previousSibling;
			while (prevNode.textContent != 'top') { // Remove Childes until <!--top-->
				prevNode = prevNode.previousSibling;
				prevNode.nextSibling.parentNode.removeChild(prevNode.nextSibling);
			}
		}
		return commentNode;
	}
	
	var callbacksCall = function(callbacks) {

		callbacks.forEach(function(callback){
			
			if (callback.type == 'htmlCollection') {
				var newNode 	= callback.newNode;
				var refNode 	= callback.refNode;
				
				if (Array.isArray(newNode)) { // callbacksArray
					if (refNode.previousSibling.nodeType == COMMENT_NODE && refNode.previousSibling.textContent == 'top') {
						// First Insert
						newNode.forEach(function(cb) {
							let newNode = cb.newNode; 
							refNode.parentNode.insertBefore(newNode, refNode);
						});						
					}
					else { // Update
						var parent = refNode.parentNode;
						var oldNodes = [];
						var start, end;
						var childNodes = parent.childNodes;
						var length = childNodes.length;
						var i = 0;
						
						while (i < length && !end) { // find the <!-- top -->, Start from parent first children
							// Find the first child top --> thats the end of the refComment 
							if (!start && childNodes[i].previousSibling && childNodes[i].previousSibling.nodeType == COMMENT_NODE && childNodes[i].previousSibling.textContent == 'top') {
								start = i;
							}
							
							if (start) {
								oldNodes.push(childNodes[i]);
							}
							
							if (!end && childNodes[i].nextSibling && childNodes[i].nextSibling.nodeType == COMMENT_NODE && childNodes[i].nextSibling.textContent == refNode.textContent) {
								end = i;
							}
							
							i++;
						}
						
						var newNodes = [];
						newNode.forEach(function(cb, index) {
							let newNode = cb.newNode;
							var childNodes = newNode.childNodes;
							var length = childNodes.length;
							var i = 0;
							childNodes.forEach(function(child, i){
								newNodes.push(child);
							}); 
						});
						
						var newLength = newNodes.length;
						var oldLength = oldNodes.length;
						
						for (let i = 0; i < newLength || i < oldLength; i++) {
							
							if (!oldNodes[i]) { // No old node we insert the new node
								refNode.parentNode.insertBefore(newNodes[i], refNode);
							}
							else if (!newNodes[i]) { // No new node we delete the old node  
								oldNodes[i].parentNode.removeChild(oldNodes[i]);
							}
							else if (!newNodes[i].isEqualNode(oldNodes[i])) { // Not equal replace the new node with the old node // if we change it manually, its recognized 
								oldNodes[i].parentNode.replaceChild(newNodes[i], oldNodes[i]);
							}
						}
						
					}

				}
			}
			else if (callback.type == 'node') {
				var newNode 	= callback.newNode;
				var refNode 	= callback.refNode;
				
				// update
				removeCommentsBlock(refNode);
				
				if (Array.isArray(newNode)) { // callbacksArray
					// Insert
					newNode.forEach(function(cb) {
						let newNode = cb.newNode; 
						let refNode = cb.refNode;
						refNode.parentNode.insertBefore(newNode, refNode);
					});
				}
				else {
					// Insert
					refNode.parentNode.insertBefore(newNode, refNode);	
				}					

			}	
			else if (callback.type == 'attribute') {
				
				if (callback.kind == 'attribute') {
					var refNode 	= callback.refNode;
					refNode.attributes[callback.name].value = callback.value;
					refNode.setAttribute('data-nippy_'+callback.name, callback.base);
				}
				else if (callback.kind == 'attribute-event') {
					var refNode = callback.refNode;
					var event 	= callback.name;
					var eventHandler = callback.value;
					refNode.addEventListener(event, eventHandler, eventHandler.handlerOptions);
					refNode.removeAttribute('on:'+callback.name);
					refNode.setAttribute('data-nippy_on:'+callback.name, callback.base);
				}
				else if (callback.kind == 'attribute-bool') {
					var refNode 		= callback.refNode;
					refNode[callback.name] = (callback.value == 'true'); // Boolean True or False
					refNode.removeAttribute('is:'+callback.name);
					refNode.setAttribute('data-nippy_is:'+callback.name, callback.base);
				}
				else if (callback.kind == 'attribute-node-prop') {
					var refNode 	= callback.refNode;
					refNode[callback.name] = callback.value; // properites
					refNode.removeAttribute('.'+callback.name);
					refNode.setAttribute('data-nippy_.'+callback.name, callback.base);
				}
			}
		});
	}
	
	var generateTemplateNodes = function(templateObj, templateNode) {
		var callbacks = [];
		callbacks = generateTemplateCallbacks(templateObj, templateNode, callbacks);
		callbacksCall(callbacks);
		return templateNode;
	}
	
	var sanitizeNode = function(node) {
		var childNodes = node.childNodes;
		var length = childNodes.length;
		var i = 0;

		while (i < length) {
			var child = childNodes[i];
			if (child.nodeType == ELEMENT_NODE) {
				// Recursive call
				sanitizeNode(child);
			}
			else if (child.nodeType == TEXT_NODE && (child.parentNode.tagName == "TEXTAREA" || child.parentNode.tagName == "STYLE")) {
				// First occurrence
				if (child.textContent.split('<!--top-->').length > 1) {
					var innerDom = createElement(child.textContent);
					child.textContent = '';
					child.parentNode.append(innerDom);	
				}
			}
			
			i++;
		}
		
		
		return node;
	}
	
	var domTemplate = function(selector, vars) {
		if (typeof selector == 'object') {
			var template = selector;	
		}
		else {
			var template = document.querySelector(selector);
		}
		
//		template = template.content.cloneNode(true);
		
		if (template) {
			var keys = [];
			var vals = [];
			if (typeof vars == 'object') {
				keys 	= Object.keys(vars);
				vals 	= Object.values(vars);
			}
			
			var templateString = htmlDecode(template.innerHTML);
			template.parentNode.removeChild(template);
			return new Function('html', ...keys, 'return html`'+templateString+'`').call(null, html,...vals);
		}
		return '';
	}
	
	var render = function(templateObj, selector) {
		var rootTemplateNode, cacheValueKey;
		if (typeof selector == 'object') {
			var rootElement = selector;	
		}
		else {
			var rootElement = document.querySelector(selector);
		}
		
		if (typeof templateObj == 'function') {
			templateObj = templateObj();
		}
		
		
		if (rootElement.nippyKey != templateObj.key) {
			rootTemplateNode = createElement(templateObj.templateStr);
		}
		else {
			rootTemplateNode = rootElement;
		}
		
		rootTemplateNode = sanitizeNode(rootTemplateNode);
		
		// CLONE Because we dont want to effect the object when diffing leter.
		templateObj 	= cloneObj(templateObj);
		cacheValueKey 	= 'values_'+templateObj.key;
		
		generateTemplateNodes(cloneObj(templateObj), rootTemplateNode);
		
		// Insert
		if (rootElement.nippyKey != templateObj.key) {
			// Remove All childNodes if when inserting
			while (rootElement.firstChild) {
				rootElement.removeChild(rootElement.firstChild);
			}
			rootElement.appendChild(rootTemplateNode);
			rootElement['nippyKey'] = templateObj.key
		}
		
		if (rootElement.nippyKey && rootElement.nodeType != DOCUMENT_FRAGMENT_NODE) { // Use cache when render into real dom
			cache.set(cacheValueKey, cloneObj(templateObj.values));
		}		
		
		return rootElement;
	}
	
	var nippy = {
		uid				: uuid(),
		html			: html,
		domTemplate		: domTemplate,
		render			: render,
		cache			: cache,
		htmlEncode		: htmlEncode,
		htmlDecode		: htmlDecode,
		htmlTemplate	: htmlTemplate,
		collection		: collection
	}
		
	return nippy;
}
