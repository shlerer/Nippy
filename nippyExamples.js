'use strict';

const nippy = Nippy();
const template = (code) => nippy.html`
	<pre>
		<code class="javascript">${code}</code>
	</pre>
`

// Input Binding
var app1 = function() {
	var App = {
		nippy: Nippy(),
		
		data: {message: 'Hello Nippy!'},
		
		onInput: function(event) {
		    App.data.message = event.target.value;
		    App.render(App.template(), '#app1 .res');
		},
		
		template: function() {
			return App.nippy.html`
		    	<pre>${this.nippy.htmlEncode(this.data.message)}</pre>
		    	<textarea rows="10" cols="30" on:input="${this.onInput}">${this.data.message}</textarea>
			`;
		},
		
		render() {
			console.log(this.data.message);
			App.nippy.render(this.template(), '#app1 .res');
		}
	};
	App.render();
}

nippy.render(template(nippy.htmlEncode(app1.toString())), '#app1 .code');
app1();



//Todo's
var app2 = function() {
	var App = {
		
		nippy: Nippy(),
		
		data: {
			title: 'The List:',
			list : [
				{name: 'Banana', 	checked: false},
				{name: 'Lemon', 	checked: false},
				{name: 'Orange', 	checked: false},
			]
		},
		
		save: function(e){
			var _this = App;
			if (e.key == 'Enter') {
				if (e.target.value) {
					App.data.list.push({name: App.nippy.htmlEncode(e.target.value)});
					e.target.value = '';
					App.render();
				}
			}
		},
		
		remove: function(e) {
			e.preventDefault();
			App.data.list.splice(this.parentNode.attributes['data-index'].value, 1);
			this.parentNode.remove();
		},
		
		checked: function(e) {
//			e.preventDefault();
			if (this.checked) {
				this.parentNode.classList.add('checked');
			}
			else {
				this.parentNode.classList.remove('checked');
			}
			App.data.list[this.parentNode.attributes['data-index'].value].checked = this.checked;
		},
		
		
		template: function() {
			return this.nippy.html`
				<h3>${this.data.title}</h3>
				<input type="text" on:keyup="${this.save}" placeholder="What needs to be done?" />
				<ul>
					${nippy.collection(this.data.list.map((item, index) => this.nippy.html`
						<li class="${item.checked ? 'checked' : ''}" data-index="${index}"> ${item.name} <a href="#" on:click="${this.remove}">delete</a> <input is:checked="${item.checked}" type="checkbox" on:click="${this.checked}"/></li>
					`))}
				</ul>
				<style>
					.checked {text-decoration: line-through;}
				<style>
			`;
		},
	
		render: function() {
			this.nippy.render(this.template(), '#app2 .res');
		}
	}
	
	App.render();
}
//nippy.render(template(nippy.htmlEncode(app2.toString())), '#app2 .code');
//app2();




//var color = 'red';
//var template2 = () => nippy.html`<div class="red">TextColorize</div>
//<style>.red{color: ${color};}</style>`;
//
//nippy.render(template2(), '#app2');
//
//setInterval(() => {
//	if (color == 'red') {
//		color = 'blue';	
//	}
//	else {
//		color = 'red';
//	}
//	
//	nippy.render(template2(), '#app2');	
//}, 1000);


//var template2 = (fname, lname) => nippy.html`<textarea rows="10" cols="30">${fname} YEah ${lname}</textarea>`;
//nippy.render(template2('Jhon', 'Doe'), '#app2');
//setTimeout(() => {
//	nippy.render(template2('Jhon', 'Boo'), '#app2');	
//}, 5000);


//var list = [
//	{name: 'Banana', 	className: 'red'},
//	{name: 'Lemon', 	className: 'red'},
//	{name: 'Orange', 	className: 'red'},
//]
//var template2 = () => nippy.html`
//<ul>
//	${nippy.collection(list.map((item) => nippy.html`<li class="${item.className}">${item.name}</li>`))}
//</ul>
//`;
//
//nippy.render(template2(), '#app2');


//var list = [
//	{name: 'Orange', disabled: true},
//	{name: 'Lemon', disabled: true},
//	{name: 'Banana', disabled: true},
//]


//list.pop();
//list.push({name: 'Melon', disabled: true});


//setTimeout(() => {
//	nippy.render(template2(), '#app2');
//}, 5000);



//var list = [
//	{name: 'Banana', 	className: 'red'},
//	{name: 'Lemon', 	className: 'red'},
//	{name: 'Orange', 	className: 'red'},
//]
//var template2 = () => nippy.html`
//<ul>
//	${nippy.collection(list.map((item) => nippy.html`<li class="${item.className}">${item.name}</li>`))}
//</ul>
//`;

//nippy.render(template2(), '#app2');


//setTimeout(() => {
//	list.push({name: 'Melon', 	className: 'red'});
//	nippy.render(template2(), '#app2');
//}, 5000);















































































