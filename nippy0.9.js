'use strict';

var Nippy = function(options) {
	var _this = this;
	
	_this.data = {};
	_this.el = null;
	_this.options = {
		el: null,
		data: {},
		literals: true,
		template: null,
		methods: {},
		vDOM: {}
	}
	
	var temp;
	var _vNode;
	var dataKeys;
	var dataValues;
	var templateFunction;
	var templateString;

	// Regex
	var onRegex = /^on:/;
	var nippyRegex = /^nippy:/;
	var ForRegex = /^nippy-for=/;
	var experssionRegex = /\$\{((?:.|\n)+?)\}/g;
	var regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g;
	
	var cached = {};

	/**
	 * Self check for benchmark
	 */
	var timer = function(name) {
	    var start = new Date();
	    return {
	        stop: function() {
	            var end  = new Date();
	            var time = end.getTime() - start.getTime();
	            console.log('Timer:', name, 'finished in', time, 'ms');
	        }
	    }
	};
	
	function isEmpty(obj) {
	    return Object.keys(obj).length === 0;
	}
	
	var setDataObjecKeysValues = function() {
		dataKeys 	= Object.keys(_this.data);
		dataValues 	= Object.values(_this.data);		
	}

	var mergeOptions = function(options) {
		for (let i in options) {
			_this.options[i] = options[i];
		}
	}
	
	var unEscapeRegExp = function(str) {
		if (typeof str != 'string') {
			return str;
		}
		var string = str;
	    return str.replace(/\\(.)/g, function ($0, $1) {
	        return $1;
	    });
	}
	
	var escapeRegExp = function(str) {
		if (typeof str != 'string') {
			return str;
		}
//	    return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
		return str.replace(/[.*+?^${}()|[\]\\`]/g, '\\$&');
	}

	var traverseObject = function(obj, func) {
	    for (var key in obj) {
	    	if (Array.isArray(obj[key])) {
	    		func(key, obj);
	    		for (var i in obj[key]) {
	    			traverseObject(obj[key][i], func);
	    		}
	    	}
	    	else {
		    	func(key, obj);
		    	if (typeof(obj[key]) == 'object') {
		    		traverseObject(obj[key], func);
		    	}
	    	}
	    	
	    }
	}
	
	var setDomGettersSetters = function(key, parentObj) {
		if (typeof(parentObj) != 'object') {
			return;
		}
		var value = parentObj[key];
		Object.defineProperty(parentObj, key, {
			get: function() {
				return value;
			},
			set: function(v) {
				value = v;
				setDataObjecKeysValues();
				updateChanges();
				traverseObject(options.data, setDomGettersSetters);
			}
		});

		// Array manipulation
		if (Array.isArray(value)) {
			arr_manipulation('push');
			arr_manipulation('pop');
			arr_manipulation('shift');
			arr_manipulation('unshift');
			arr_manipulation('splice');
			arr_manipulation('sort');
			arr_manipulation('reverse');
		}
		
		/**
		 * action: push, pop
		 */
		function arr_manipulation(action) {
			var original = Array.prototype[action];
			Object.defineProperty(value, action, {
			    writable: true,
			    configurable: true,
				value: function(){
					var args = [];
					for (var i in arguments) {
						args[i] = arguments[i];
					}
					var result = original.apply(this, args);
					
					
					setDataObjecKeysValues();
					updateChanges();
					traverseObject(options.data, setDomGettersSetters);
					return result;
				}
			});
		}
	}
	
	var SaferHTML = function(templateData) {
	  var s = templateData[0];
	  for (var i = 1; i < arguments.length; i++) {
	    var arg = String(arguments[i]);

	    // Escape special characters in the substitution.
	    s += arg.replace(/&/g, "&amp;")
	            .replace(/</g, "&lt;")
	            .replace(/>/g, "&gt;");

	    // Don't escape special characters in the template.
	    s += templateData[i];
	  }
	  return s;
	}

	/**
	 * Data string interpolation
	 */
	var generateTemplateData = function(templateString, keys, values) {
		if (templateString){
			var fn;
			keys 	= keys ? keys : dataKeys;
			values 	= values ? values : dataValues;
			var cacheKey = 'generateTemplateData'+templateString;
			fn = cached[cacheKey];
			if (!fn) {
				fn = cached[cacheKey] = new Function(...keys, 'return `' + templateString + '`;');
			}
			return fn(...values);
		}
		return templateString;
	}

	/**
	 * Event Handling
	 */
	var generatEventsHandlers = function(node, options) {
		let children = node.getElementsByTagName('*');
		let methods = options.methods;

		for (let i = 0; i < children.length; i++) {
			let element = children[i];
			let attrs = element.attributes;
			
			for (let i = 0; i < attrs.length; i++) {
				let attr = attrs[i];
				if (onRegex.test(attrs[i].name)) { // on:EVENT
					let event = null;
					event = attr.name.split(':')[1];
					attr.value = generateTemplateData(attr.value) // Genreate Template data if there is

					element.addEventListener(event, function(e){
						let elm = this;
						return new Function('$nippy, $event, $this, $data, methods', attr.value+'; ').call(null, _this, e, elm, options.data, options.methods);
					});

					element.removeAttribute(attr.name); // Remove attribute after assigning the event
				}
			}
		}

		return node;
	}

	var tempNodeFromString = function(string) {
		// New element
		var tempNode= document.createElement('div');
		tempNode.innerHTML = string;
		return tempNode;
	}

	/**
	 * Unwrap element and return it as frgamant document (because we cant return without parent)
	 */
	var unwrapFragment = function(node) {
		// Document Fragment
		var docFrag = document.createDocumentFragment();
		while (node.firstChild) {
	        let child = node.removeChild(node.firstChild);
	        docFrag.appendChild(child);
	    }

		return docFrag;
	}

	var getTemplateFunction = function(options) {
		var template = options.template;
		if (typeof template == 'function') {
			return template;
		}
		else if (options.template){
			template = document.querySelector(options.template);
			if (template) {
				var templateString = template.innerHTML;
				return new Function('return `' + templateString + '`;');
			}
		}
		return new Function('return "";');;
	}

	var convertTemplateFunctionToString = function(templatefunction) {
		var templateString = templatefunction.toString().replace(/\${/g,"%{");
		templateString = templateString.replace(/<!--(.*?)-->/g, ''); // Remove html comments
		return new Function('var t = '+templateString+'(); t = t.toString().replace(/%{/g,"${"); return t;')();
	}

	var getTemplateVars = function(string) {
		var res = {};
		if (experssionRegex.test(string)) {
			var m;

			experssionRegex.lastIndex = 0;
			while (m = experssionRegex.exec(string)) {
				var arr = [];
				let m1 = m[1].replace(/[^\w\s\[\].$]/g, ' ')
				m1 = m1.replace(/  +/g, ' ').trim(); // Replcae

//				console.log(m[0], m1);

				res[m[0]] = [];
				m1.split(' ').forEach(function(v,i){
					if (v) {
						arr.push(v);
					}
				});
				res[m[0]] = arr;
			}
			return res;
		}
		return;
	}

	var parse = function (val){
		var afterParse		= generateTemplateData(val);
		var templateVars    = getTemplateVars(val);

		if (!templateVars) {
			return {};
		}

		return {
			beforeParse: val,
			afterParse: afterParse,
			templateVars: templateVars
		}
	}

	/**
	 * Simple clone
	 */
	var cloneObj = function(obj) {
		if (Array.isArray(obj)) {
			return JSON.parse(JSON.stringify(obj));
		}
		if (typeof obj == 'object') {
			return Object.assign({}, obj);
		}
		return obj;
	}

	/**
	 * vNode Clone
	 */
	var cloneVnode = function(vNode) {
		var cloned = new VNode({
			cloned			: true,
			attributes		: cloneObj(vNode.attributes),
			domAttributes	: cloneObj(vNode.domAttributes),
			nodeName		: vNode.nodeName,
			nodeType		: vNode.nodeType,
			tagName			: vNode.tagName,
			type			: vNode.type,
			nodeValue		: vNode.nodeValue,
			parent			: vNode.parent,
			elm				: vNode.elm,
//			childNodes		: vNode.childNodes
		});
		cloned.childNodes     = [];
		
		if (vNode.childNodes.length > 0) {
			for (var i =0; i < vNode.childNodes.length; i++) {
				var chlidClone = new cloneVnode(vNode.childNodes[i]);
				chlidClone.parent = cloned;
				cloned.childNodes.push(chlidClone);		
			}
		}
		
		return cloned;
	}
	
	var VNode = function(params = {}) {
		this.tagName 	= undefined;
		this.type 		= undefined;
		this.nodeName 	= undefined;
		this.nodeValue 	= undefined;
		this.childNodes = undefined;
		this.attributes = undefined;
		this.domAttributes = undefined;
		this.nodeType 	= undefined;
		this.parent 	= undefined;
		this.elm		= undefined;
		this.parsed 	= undefined;
		this.generatedValue = undefined;
		
		for (var i in params) {
			this[i] = params[i];
		}
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
	
	var getDomAttributes = function(elm) {
		var domAttributes = []; 
		if (elm.tagName == 'TEXTAREA' && elm.value) {
			domAttributes.push({name: 'value', value: elm.value});	
		}
		else if (elm.tagName == 'INPUT') {
			domAttributes.push({name: 'value', value: elm.value});
			if (elm.type == 'checkbox') {
				domAttributes.push({name: 'checked', value: elm.checked});
			}
			else if (elm.type == 'radio') {
				domAttributes.push({name: 'checked', value: elm.checked});
			}
		}
		else if (elm.tagName == 'SELECT') {
			if (elm.type == 'select-one') {
				domAttributes.push({name: 'selectedIndex', value: elm.selectedIndex});
				domAttributes.push({name: 'value', value: elm.value});
			}
		}
		else if (elm.tagName == 'OPTION') {
			domAttributes.push({name: 'value', value: elm.value});
			domAttributes.push({name: 'selected', value: elm.selected});
		}
		return domAttributes;
	}
	
	var toVirtualDom = function(node) {
	  var vNode = new VNode();

	  var attrs = getElmAttributes(node);
	  if (attrs) {
		  var length = attrs.length;
		  vNode.attributes = new Array(length);
		  for (var i = 0; i < length; i++) {
			  vNode.attributes[i] = attrs[i]; 
		  }
	  }
	  
	  var domAttrs = getDomAttributes(node);
	  if (domAttrs) {
		  var length = domAttrs.length;
		  vNode.domAttributes = {};
		  for (var i = 0; i < length; i++) {
			  vNode.domAttributes[domAttrs[i].name] = domAttrs[i].value; 
		  }
	  }
	  
	  vNode.nodeType = node.nodeType;
	  
	  vNode.elm = node;
	  
	  if (node.tagName) {
		  vNode.tagName = node.tagName.toLowerCase();
	  } 

	  if (node.type) {
		  vNode.type = node.type.toLowerCase();
	  } 
	  
	  if (node.nodeName) {
		  vNode.nodeName = node.nodeName;
	  }
	  
	  if (node.nodeValue) {
		  vNode.nodeValue = node.nodeValue;
	  }
	  
	  var childNodes = node.childNodes;
	  if (childNodes) {
		  length = childNodes.length;
		  vNode.childNodes = new Array(length);
		  for (var j = 0; j < length; j++) {
			  vNode.childNodes[j] = toVirtualDom(childNodes[j]);
			  vNode.childNodes[j].parent = vNode;
		  }
	  }
	  return vNode;
	}
	
	
	var addAttributes = function(node, attributes) {
		var attributes = attributes || [];
		var attrs = {};
		// Concat attributes
    	for (let i = 0, len = attributes.length; i < len; i++) {
    		if (!attrs[attributes[i].name]) {
    			attrs[attributes[i].name] = '';
    		}
    		if (attributes[i].name) {
    			if (attributes[i].value) {
        			attrs[attributes[i].name]+= attrs[attributes[i].name] ? ' ' : '';
        			attrs[attributes[i].name]+= attributes[i].value;	
    			}
    		}
    	}
    	// Set attributes
    	for (let name in attrs) {
    		node.setAttribute(name, attrs[name]);
    	};
	}

	/**
	 * recursive from leafs
	 */
	var generatDomAttributes = function (vNode) {
		// Starting from leafs
		var childNodes = vNode.childNodes || [];
		for (var i = 0; i < childNodes.length; i++) {
			generatDomAttributes(childNodes[i]);
		}
		
		if (!isEmpty(vNode.domAttributes)) {
			for (var name in vNode.domAttributes) {
				var flag = true;
				for (let j = 0, len = vNode.attributes.length; j < len; j++) {
					if (vNode.attributes[j].name == name) { // vNode.attributes agianst vNode.domAttributes -> vNode.attributes wins fromVirtualDom generations    
						flag = false;
						break;
					}
				}
				if (flag) {
					vNode.elm[name] = vNode.domAttributes[name];	
				}
			}
		}
	}
	
	var fromVirtualDom = function(vNode) {
	  if (typeof obj == 'string') {
		  vNode = JSON.parse(vNode);
	  }
	  var node, nodeType = vNode.nodeType;
	  
	  switch (nodeType) {
	    case 1: //ELEMENT_NODE
	    	var attributes = vNode.attributes || [];
	    	node = document.createElement(vNode.tagName);
	    	addAttributes(node, attributes);
	      break;
	    case 3: //TEXT_NODE
	    	node = document.createTextNode(vNode.generatedValue ? vNode.generatedValue : vNode.nodeValue);
	    	break;
	    case 8: //COMMENT_NODE
	    	node = document.createComment(vNode.generatedValue ? vNode.generatedValue : vNode.nodeValue);
	    	break;
	    case 9: //DOCUMENT_NODE
	    	node = document.implementation.createDocument();
	    	break;
	    case 10: //DOCUMENT_TYPE_NODE
	    	node = document.implementation.createDocumentType(vNode.nodeName);
	    	break;
	    case 11: //DOCUMENT_FRAGMENT_NODE
	    	node = document.createDocumentFragment();
	    	break;
	    default:
	    	return node;
	  }
	  
	  if (nodeType == 1 || nodeType == 11) {
		  var childNodes = vNode.childNodes || [];
		  for (var i = 0, len = childNodes.length; i < len; i++) {
			  node.appendChild(fromVirtualDom(childNodes[i]));
		  }
	  }

	  vNode.elm = node;
	  generatDomAttributes(vNode);
	  return node;
	}

	var generateParseVDomNode = function(vNode) {
		var parsed = parse(vNode.nodeValue);
		vNode.parsed = parsed;
		
		if (vNode.parsed.templateVars && vNode.parsed.afterParse) {
			vNode.generatedValue = vNode.parsed.afterParse;
			vNode.data			= vNode.generatedValue;
			if (vNode.elm) {
				vNode.elm.nodeValue = vNode.generatedValue;
			}	
		}
		
		if (!isEmpty(vNode.domAttributes)) {
			for(var i in vNode.domAttributes) {

				let _dataKeys 	= cloneObj(dataKeys);
				let _dataValues 	= cloneObj(dataValues);
				
				if (vNode.scopeVars) {
					_dataKeys.push(...Object.keys(vNode.scopeVars));
					_dataValues.push(...Object.values(vNode.scopeVars));	
				}
				vNode.domAttributes[i] = generateTemplateData(vNode.domAttributes[i],_dataKeys,_dataValues);
		    }
		}
	}

	var generateVDomTemplate = function(vNode) {
		if (typeof vNode == 'string') {
			vNode = JSON.parse(vNode);
		}
		
		var childNodes = vNode.childNodes || [];
		
		var len, i;
		for (i = 0, len = childNodes.length; i < len; i++) {
			generateVDomTemplate(childNodes[i]);
		}
		
		// Generate & Parse
		generateParseVDomNode(vNode);
		
		return vNode;
	}

	var getVarsFromIterator = function(iterator) {
		var split;
		if ((split = iterator.split('in')) && (split.length == 2)) {
			if (split.length == 2) { // For i in object
				var index = split[0].trim();
				var value = split[1].trim();
				var alias = 'in';
				
			}
		}
		else if ((split = iterator.split('to')) && (split.length == 2)) {
			var index = split[0].trim();
			var value = split[1].trim();
			var alias = 'to';
		}
		return {'value': value, 'index': index, alias: alias};
	}

	/**
	 * recursive from parents
	 */
	function parseForScopeVars(vNode, scopeVars) {
		scopeVars = vNode.scopeVars || scopeVars || {}
		
		if (vNode.nodeValue) {
			let scopeKeys 	= cloneObj(dataKeys);
			let scopeValues = Object.values(dataValues);
			scopeKeys.push(...Object.keys(scopeVars));
			scopeValues.push(...Object.values(scopeVars));
			vNode.nodeValue = generateTemplateData(vNode.nodeValue, scopeKeys, scopeValues);
		}
		
		// Starting from parents
		var childNodes = vNode.childNodes || [];
		for (var i = 0; i < childNodes.length; i++) {
			parseForScopeVars(childNodes[i], scopeVars);
		}
	} 

	/**
	 * recursive from parents
	 */
	var generateForAttr = function(vNode, scopeVars) {
		var attrs = vNode.attributes;
		if (attrs && attrs.length > 0) {
			for (let j = 0; j < attrs.length; j++) {
				if (attrs[j] && attrs[j].name == 'nippy:for') {
					var cacheKey, fn;
					var vars  		 = getVarsFromIterator(attrs[j].value);
					var index 		 = vars.index;
					var value 		 = vars.value;
					var alias 	 	 = vars.alias;
					if (alias == 'in') {
						var iterator 	 =  vars.index+' '+vars.alias+' '+vars.value;
					}
					if (alias == 'to') {
						var iterator 	 =  vars.index+'=0; '+vars.index+'<='+vars.value+'; '+vars.index+'++';
					}
					
					scopeVars = cloneObj(scopeVars) || {};
					
					var cloneVnodes = [];
					var innerFunc = cacheKey = 'var '+index+'; for('+iterator+') {scopeVars = cloneObj(scopeVars); scopeVars["'+index+'"] = cloneObj('+value+'['+index+']); var clonedVnode = cloneVnode(vNode); clonedVnode.scopeVars = scopeVars; cloneVnodes.push(clonedVnode); };';
					var fn = cached[cacheKey];
					if (!fn) {
						fn = new Function('scopeVars', 'cloneObj', 'cloneVnode','cloneVnodes', 'vNode', ...dataKeys, innerFunc);
					}
					fn(scopeVars, cloneObj, cloneVnode, cloneVnodes, vNode, ...dataValues);
					//console.log(fn.toString());
					
					var pos = vNode.parent.childNodes.indexOf(vNode);
					vNode.parent.childNodes.splice(pos, 1, ...cloneVnodes); // Add the new children instead the "nippy-for" element
					
					cloneVnodes.forEach(function(clonedVnode){
						clonedVnode.attributes.forEach(function(attr,i){
							if (attr.name == 'nippy:for') {
								clonedVnode.attributes.splice(i,1); // Like "delete child.attributes[i]" but reset the array length
							}
						});

						generateForAttr(clonedVnode, clonedVnode.scopeVars); // Recursive call for inner loop
						parseForScopeVars(clonedVnode, {}); // Generate for tempalte values
					});
						
					vNode.childNodes = []; // We dont want duplicate running on nippy::for

				}
			}
		}
		
		// Starting from parents
		var childNodes = vNode.childNodes || [];
		for (var i = 0; i < childNodes.length; i++) {
			generateForAttr(childNodes[i], scopeVars);
		}
	}
	
	
	/**
	 * recursive from parents
	 */
	var generateModelAttr = function(vNode) {
		var attrs = vNode.attributes;
		if (attrs && attrs.length > 0) {
			for (let j = 0; j < attrs.length; j++) {
				
				if (attrs[j] && attrs[j].name == 'nippy:model') {
					var key = attrs[j].value;
					var dataValue = escapeRegExp(_this.options.data[key]); // Escaping data after insert text into input
					
					// Select
					if (vNode.tagName == 'select') {
						// Remove nippy:model
						vNode.attributes.splice(j,1);
						
						if (vNode.type == 'select-one') {

							var fn = function fn (key, $event, $data) {
								if ($event.target.options.selectedIndex > -1) {
									$data[key] = $event.target.options[$event.target.options.selectedIndex].value;
								}
								else {
									$data[key] = '';
								}
							};

							attr = {name: 'on:change', value: '('+fn.toString()+')("'+key+'", $event, $data);'};
							vNode.attributes.push(attr);
							
							vNode.model = true;
							vNode.attributesChanged = true;

							vNode.domAttributes.value = dataValue;
							vNode.elm.value = dataValue;
						}
						else if (vNode.type == 'select-multiple' && Array.isArray(dataValue)) {
							// Set defulat values
							if (vNode.elm.options) {
								var childNodes = vNode.childNodes || [];
								for (var i = 0; i < childNodes.length; i++) {
									if (childNodes[i].tagName == 'option' && dataValue.indexOf(childNodes[i].elm.value) > -1) {
										childNodes[i].domAttributes.selected = true;
										childNodes[i].elm.selected = true;
									}
								}
							}
							
							var fn = function fn (key, $event, $data) {
								var selected = [];
								for (var i = 0; i < $event.target.options.length; i++) {
									if ($event.target.options[i].selected) {
										selected.push($event.target.options[i].value);
									}
								}
								$data[key] = selected;
							};
							

							attr = {name: 'on:change', value: '('+fn.toString()+')("'+key+'", $event, $data);'};
							vNode.attributes.push(attr);
							
							vNode.model = true;
							vNode.attributesChanged = true;
						}

					}
					// Radio
					else if (vNode.tagName == 'input' && vNode.type == 'radio' ) {
						var attr = {};
						// Remove nippy:model
						vNode.attributes.splice(j,1);

						checked = (vNode.elm.value == dataValue);
						
						if (checked) {
							attr = {name: 'checked', value: true};
							vNode.attributes.push(attr);
						}
						
						var fn = function fn (key, $event, $data) {
							if ($event.target.checked) {
								$data[key] = $event.target.value;
							}
							else {
								$data[key] = '';
							}
						};
						
						attr = {name: 'on:change', value: '('+fn.toString()+')("'+key+'", $event, $data);'};
						vNode.attributes.push(attr);
						
						vNode.model = true;
						vNode.attributesChanged = true;
						
						// Setting elm.value for checking later in newVnode
						vNode.domAttributes.checked = checked;
						vNode.elm.checked = checked;
					}
					// Checkbox
					else if (vNode.tagName == 'input' && vNode.type == 'checkbox' ) {
						var attr = {};
						var checked = false;
						// Remove nippy:model
						vNode.attributes.splice(j,1);

						// Init input
						if (Array.isArray(dataValue)) {
							if (dataValue.indexOf(vNode.elm.value) > -1) {
								attr = {name: 'checked', value: true};
								vNode.attributes.push(attr);
								checked = true;
							}	
						}
						else if (dataValue) {
							attr = {name: 'checked', value: true};
							vNode.attributes.push(attr);
							checked = true;
						}

						var fn = function fn (key, $event, $data) {
							var value;
							
							if (Array.isArray($data[key])) {
								if ($event.target.checked) {
									$data[key].push($event.target.value);
								}
								else {
									for (let i in $data[key]) {
										if ($data[key][i] == $event.target.value) {
											$data[key].splice(i,1);
										}
									}
								}
							}
							else {
								if ($event.target.value == 'on') {
									value = $event.target.checked ? true : false;
								}
								else if (!$event.target.defaultValue) {
									value = $event.target.checked;
								}
								else {
									value = $event.target.checked ? $event.target.value : false;
								}
								$data[key] = value;
							}
						};
						
						// Event handler
						attr = {name: 'on:change', value: '('+fn.toString()+')("'+key+'", $event, $data);'};
						vNode.attributes.push(attr);
						
						vNode.model = true;
						vNode.attributesChanged = true;

						// Setting elm.value for checking later in newVnode
						vNode.domAttributes.checked = checked;
						vNode.elm.checked = checked;
						
					}
					// Input / Textarea
					else if (vNode.tagName == 'input' || vNode.tagName == 'textarea' ) { 
						var attr = {};
						// Remove nippy:model
						vNode.attributes.splice(j,1);
						
						// Remove initial value from value="xxx" if ther is
						if (vNode.tagName == 'input') {
							for (let k = 0; k < attrs.length; k++) {
								if (attrs[k] && attrs[k].name == 'value') {
									vNode.attributes.splice(k,1);
								}
							}
							// Init input
							attr = {name: 'value', value: dataValue};
							vNode.attributes.push(attr);
						}
						
						// Event handler
						var fn = function fn (key, $event, $data) {$data[key] = $event.target.value;}
						attr = {name: 'on:input', value: '('+fn.toString()+')("'+key+'", $event, $data);'};
						vNode.attributes.push(attr);
						
						vNode.model = true;
						vNode.attributesChanged = true;
						
						vNode.domAttributes.value = dataValue;
						vNode.elm.value = dataValue;
					}
				}
			}
		}
		
		// Starting from parents
		var childNodes = vNode.childNodes || [];
		for (var i = 0; i < childNodes.length; i++) {
			generateModelAttr(childNodes[i]);
		}
	}
	
	/**
	 * recursive from parents
	 */
	var generateBindAttr = function(vNode) {
		var attrs = vNode.attributes;
		if (attrs && attrs.length > 0) {
			vNode.attributesBindStr = '';
			for (let j = 0; j < attrs.length; j++) {
				var split = attrs[j].name.split(':');
				if (split[0] == 'nippy' && split[1] == 'bind' && split[2]) {
					var val = attrs[j].value;
					var name = split[2];
					
					let _dataKeys 		= cloneObj(dataKeys);
					let _dataValues 	= cloneObj(dataValues);
					
					if (vNode.scopeVars) {
						_dataKeys.push(...Object.keys(vNode.scopeVars));
						_dataValues.push(...Object.values(vNode.scopeVars));	
					}
					
					var value = new Function(..._dataKeys, 'return `${'+val+'}`;')(..._dataValues);
					
					vNode.attributes[j].name = name;
					vNode.attributes[j].value = value;
					
					vNode.domAttributes[name] = value;
					
					vNode.attributesChanged = true;
					vNode.attributesBindStr += value; 
				}
			}
		}

		// Starting from parents
		var childNodes = vNode.childNodes || [];
		for (var i = 0; i < childNodes.length; i++) {
			generateBindAttr(childNodes[i]);
		}
	}
	
	/**
	 * recursive from parents
	 */
	var generateIfAttr = function(vNode) {
		var attrs = vNode.attributes;
		if (attrs && attrs.length > 0) {
			for (let j = 0; j < attrs.length; j++) {

				if (attrs[j] && attrs[j].name == 'nippy:elseif') {
					var condition = attrs[j].value;
					var pos = vNode.parent.childNodes.indexOf(vNode);
					
					var flag = new Function(...dataKeys, 'return JSON.parse(`${'+condition+'}`);')(...dataValues);
										
					vNode.elseif = flag;
					
					if (pos > -1 && vNode.parent.childNodes[pos-1]) {
						var p = 1;
						while (vNode.parent.childNodes[pos-p].nodeType != 1) {
							p++;
						}
						if (!flag || vNode.parent.childNodes[pos-p].if === true || vNode.parent.childNodes[pos-p].elseif === true) {
							vNode.parent.childNodes.splice(pos, 1);
						}
					}

					vNode.attributes.forEach(function(attr,i){
						if (attr.name == 'nippy:elseif') {
							vNode.attributes.splice(i,1); // Like "delete child.attributes[i]" but reset the array length
						}
					});	
				}
				
				if (attrs[j] && attrs[j].name == 'nippy:else') {
					var pos = vNode.parent.childNodes.indexOf(vNode);
					if (pos > -1 && vNode.parent.childNodes[pos-1]) {
						var p = 1;
						while (vNode.parent.childNodes[pos-p].nodeType != 1) {
							p++;
						}
						if (vNode.parent.childNodes[pos-p].if === true || vNode.parent.childNodes[pos-p].elseif === true) {
							vNode.parent.childNodes.splice(pos, 1);
						}
					}

					vNode.attributes.forEach(function(attr,i){
						if (attr.name == 'nippy:else') {
							vNode.attributes.splice(i,1); // Like "delete child.attributes[i]" but reset the array length
						}
					});	
				}
				
				if (attrs[j] && attrs[j].name == 'nippy:if') {
					var condition = attrs[j].value;
					var pos = vNode.parent.childNodes.indexOf(vNode);
					
					var flag = new Function(...dataKeys, 'return JSON.parse(`${'+condition+'}`);')(...dataValues);
										
					vNode.if = flag;
					if (!flag) {
						if (pos > -1) {
							vNode.parent.childNodes.splice(pos, 1);
							// Check nippy:else
						}
					}
					vNode.attributes.forEach(function(attr,i){
						if (attr.name == 'nippy:if') {
							vNode.attributes.splice(i,1); // Like "delete child.attributes[i]" but reset the array length
						}
					});	
				}
			}
		}
	
		
		// Starting from parents
		var childNodes = vNode.childNodes || [];
		for (var i = 0; i < childNodes.length; i++) {
			generateIfAttr(childNodes[i]);
		}
	}
	

	/**
	 * recursive from parents
	 */
	var generateShowAttr = function(vNode) {
		var attrs = vNode.attributes;
		if (attrs && attrs.length > 0) {
			for (let j = 0; j < attrs.length; j++) {
				if (attrs[j] && attrs[j].name == 'nippy:show') {
					var condition = attrs[j].value;
//					console.log(vNode);
					var originDisplay = vNode.elm.style.display;
					var flag = new Function(...dataKeys, 'return JSON.parse(`${'+condition+'}`);')(...dataValues);
					
					if (!flag) {
						vNode.elm.style.display = 'none';
					}
					
					vNode.attributesChanged = true;
					vNode.show = flag;
					
					var _attr = getElmAttributes(vNode.elm);
					if (_attr) {
						var length = _attr.length;
						vNode.attributes = new Array(length);
						for (var i = 0; i < length; i++) {
							vNode.attributes[i] = _attr[i]; 
						}
					}

					vNode.attributes.forEach(function(attr,i){
						if (attr.name == 'nippy:show') {
							vNode.attributes.splice(i,1); // Like "delete child.attributes[i]" but reset the array length
						}
					});
				}
			}
		}
		
		// Starting from parents
		var childNodes = vNode.childNodes || [];
		for (var i = 0; i < childNodes.length; i++) {
			generateShowAttr(childNodes[i]);
		}

	}
	
	var generateNodeAttributes = function(vNode) {
		generateIfAttr(vNode);
		generateForAttr(vNode);
		generateShowAttr(vNode);
		generateBindAttr(vNode);
		generateModelAttr(vNode);
	}

	/**
	 * https://medium.com/@deathmood/how-to-write-your-own-virtual-dom-ee74acc13060
	 */
	var updateChanges = function() {
		var tempNode = tempNodeFromString(templateString);
		var newVnode = toVirtualDom(tempNode);
		generateNodeAttributes(newVnode);
		generateVDomTemplate(newVnode);
		updateElement(_vNode.parent, newVnode, _vNode);
	}
	
	var updateElement = function(oldVnodeParent, newVnode, oldVnode) {
		
		if (oldVnode && newVnode && newVnode.attributesChanged) {
			if (oldVnode.show != newVnode.show) {
				oldVnode.show = newVnode.show
				oldVnode.attributes = newVnode.attributes;
				oldVnode.elm.style.display = newVnode.elm.style.display
			}
			
			if (oldVnode.attributesBindStr != newVnode.attributesBindStr) {
				var newAttributes = newVnode.attributes || [];
				addAttributes(oldVnode.elm, newAttributes);
			}

			if (oldVnode.model) {
				if (oldVnode.domAttributes.value != newVnode.domAttributes.value) {
					oldVnode.domAttributes 	= newVnode.domAttributes;
					oldVnode.elm.value 		= newVnode.domAttributes.value;
				}
				else if (oldVnode.elm.value != newVnode.elm.value && !newVnode.domAttributes.value) {
					oldVnode.attributes = newVnode.attributes;
					oldVnode.elm.value 	= newVnode.elm.value;
				}

				if (oldVnode.domAttributes.checked != newVnode.domAttributes.checked) {
					oldVnode.domAttributes 	= newVnode.domAttributes;
					oldVnode.elm.checked 	= newVnode.domAttributes.checked;
				}
				else if (oldVnode.elm.checked != newVnode.elm.checked && !newVnode.domAttributes.checked) {
					oldVnode.attributes  = newVnode.attributes;
					oldVnode.elm.checked = newVnode.elm.checked
				}
				
			}
		}
		
		if (!oldVnode) {
			newVnode.parent = oldVnodeParent;
			oldVnodeParent.childNodes[oldVnodeParent.childNodes.length] = newVnode;
			oldVnodeParent.elm.appendChild(fromVirtualDom(newVnode));
			generatEventsHandlers(oldVnodeParent.elm, _this.options);

		}
		else if (!newVnode) {
			var pos = oldVnodeParent.childNodes.indexOf(oldVnode);
			if (pos > -1) {
				oldVnodeParent.childNodes.splice(pos, 1);
				oldVnodeParent.elm.removeChild(oldVnode.elm);
			}
		}
		// Dom Changed
		else if ((typeof newVnode !== typeof oldVnode) || (newVnode.nodeType == 3 && newVnode.data != oldVnode.data) || (newVnode.nodeType != oldVnode.nodeType)) {
			// We want to keep the parent reference for the next updateChanges 
			// Add the new children instead the old element to oldVnode (_vNode)
			var pos = oldVnodeParent.childNodes.indexOf(oldVnode);
			if (pos > -1) {
				newVnode.parent = oldVnodeParent; 
				oldVnodeParent.childNodes.splice(pos, 1, newVnode); 
				// Replace elm in the dom
				oldVnodeParent.elm.replaceChild(fromVirtualDom(newVnode), oldVnode.elm);
				generatEventsHandlers(oldVnodeParent.elm, _this.options);
			}
		}
		else {
			var newLength 	= newVnode.childNodes.length;
			var oldLength  	= oldVnode.childNodes.length;
			
			for (let i = 0; i < newLength || i < oldLength; i++) {
				updateElement(oldVnode, newVnode.childNodes[i],  oldVnode.childNodes[i]);
			}	
		}
	}

	var renderStart = function(el, options) {
		// Get Tempalte Function
		templateFunction = getTemplateFunction(options);
		// Get Tempalte as String
		templateString = convertTemplateFunctionToString(templateFunction);
		// Create Vdom
		_vNode = toVirtualDom(el);
		updateChanges();

	}

	/**
	 * START
	 */
	// Merge options
	mergeOptions(options);
	// Assign Data to instance
	_this.data = _this.options.data;
	// GettersSetters
//	traverseObj(options.data, setDomGettersSetters);
	traverseObject(options.data, setDomGettersSetters)
	// Set Keys and Values to arrays
	setDataObjecKeysValues();
	// Render to Html
	_this.el = document.querySelector(_this.options.el);
	renderStart(_this.el, options);
}





