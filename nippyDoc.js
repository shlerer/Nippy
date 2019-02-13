'use strict';

function htmlencode(str) {
    return str.replace(/[&<>"']/g, function($0) {
        return "&" + {"&":"amp", "<":"lt", ">":"gt", '"':"quot", "'":"#39"}[$0] + ";";
    });
}

const nippy = Nippy();

var template = (data) => nippy.html`
<h2>${data.title}</h2>
<p>${data.description}</p>
<pre>
	<code class="javascript">
		${data.codeEncode()}
	</code>
</pre>
${data.results ? '<h3>Results:</h3>' : ''}

<div class="res"></div>
<hr>
`;


var data = {
	results : true,
	title: 'Render dynamic text content',
	description: 'To make your template dynamic, you can create a template function. Call the template function any time your data changes.',
	codeEncode: function(){
		return htmlencode(this.code)
	},
	code:`
const nippy = Nippy();
//Define a template function
const  myTemplateA = (name) => nippy.html\`<div>Hello \$\{name\}</div>\`;

// Render the template with some data
nippy.render(myTemplateA('world'), '#DynamicContent .res');

// ... Later on ... 
// Render the template with different data
nippy.render(myTemplateA('Nippy'), '#DynamicContent .res');
`
}

nippy.render(template(data), '#dynamicContent');
eval(data.code); // Render Real code.
nippy.refreshCache();


/////////////////////////

var data = {
	results : true,
	title: 'Bind to attributes',
	description: `In addition to using expressions in the text content of a node, you can bind them to a node’s attribute and property values, too.<br>
				- Use the <b>"is:"</b> prefix for a boolean attribute binding. The attribute is added if the expression evaluates to a truthy value, removed if it evaluates to a falsy value`,
	codeEncode: function(){
		return htmlencode(this.code)
	},
	code:`
// set the class attribute
const myTemplateB = (className, color, disabled) => nippy.html\`<button style="color: \$\{color\}" is:disabled="\$\{disabled\}" class="\$\{className\}">Stylish Button disabled.</button>\`;

// Render the template with data
nippy.render(myTemplateB('stylishClass', 'red', 'true'), '#bindAttr .res');
`
}

nippy.render(template(data), '#bindAttr');
eval(data.code);
nippy.refreshCache();

/////////////////////////


var data = {
	title: 'Bind to properties',
	description: `
	You can also bind to a node’s JavaScript properties using the <b>"."</b> prefix and the property name:
	`,
	codeEncode: function(){
		return htmlencode(this.code)
	},
	code:`
const myTemplateC(data) = nippy.html\`<my-list .listItems=\$\{data.items\}></my-list>\`
`
}

nippy.render(template(data), '#bindProp');
nippy.refreshCache();

/////////////////////////

var data = {
	results : true,
	title: 'Bind to attributes',
	description: `mplates can also include declarative event handlers. An event handler looks like an attribute binding, but with the prefix <b>"on:eventName"</b> followed by an event name.<br>
	The event handler can be either a plain function, or an object with a handleEvent method:`,
	codeEncode: function(){
		return htmlencode(this.code)
	},
	code:`
var clickHandler = {
	handleEvent: function(e) {
		e.preventDefault(); 
		alert('Clicked!');
	},
}
const myTemplateD = (click) => nippy.html\`<a href="#" on:click="\$\{\click\}" >Click Here</a>\`;
nippy.render(myTemplateD(clickHandler), '#eventHandlers .res');
`
}

nippy.render(template(data), '#eventHandlers');
eval(data.code);
nippy.refreshCache();



/////////////////////////

var data = {
	results : true,
	title: 'Nested templates',
	description: `You can also compose templates to create more complex templates. <br> 
	When a binding in the text content of a template returns a TemplateResult, the TemplateResult is interpolated in place.`,
	codeEncode: function(){
		return htmlencode(this.code)
	},
	code:`
var title = 'My Title';
var header = nippy.html\`<h4>\$\{title\}</h4>\`;
var myTemplateE = (header) => nippy.html\`
  \$\{header\}
  <p>And the body...</p>
\`;
nippy.render(myTemplateE(header), '#nested .res');
`
}

nippy.render(template(data), '#nested');
eval(data.code);
nippy.refreshCache();

/////////////////////////
	
	
	

	
	
	

	
	
	

	
	
	

	
	
	

	
	
	

	
	
	
		
	
	
	
	