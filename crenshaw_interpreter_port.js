(function(console,process,require) {
	'use strict';
	String.prototype.splice=function(idx,rem,str) {
		return this.slice(0,idx)+str+this.slice(idx+Math.abs(rem));
	};
	
	var
		string=(true
				//Probably considered bad practice, but this is a single purpose script with no async tasks... yet?
				? require('fs').readFileSync('test_interpreter.js','utf8')
				//For faster tweaking and testing
				: '((1+2)*3-(-3))/4'
			)
		,char_i=-1
		,look='' //lookahead Character
		,error_marker='[ERR]'
		,table={}
		,prompt=require('cli-core').prompt
	;
	
	function getChar() {
		look=string[++char_i]||'';
		return look;
	}
	
	function error(s) {
		throw new Error(
			s+'\n'
			+'"'
			+string
				.splice(char_i,0,error_marker)
				.slice(Math.max(char_i-10,0),char_i+10+error_marker.length)
			+'"'
		);
	}
	
	function abort(s) {
		error(s);
		process.exit(-1);
	}
	
	function expected(s) {
		abort(s+' Expected');
	}
	
	function isAlpha(c) {
		if (typeof c!=='string') {throw new Error('Expected String, got '+typeof c);}
		return (/[a-z]/i).test(c);
	}
	
	function isDigit(c) {
		if (typeof c!=='string') {throw new Error('Expected String, got '+typeof c);}
		return (/[0-9]/).test(c);
	}
	
	function isAlNum(c) {
		if (typeof c!=='string') {throw new Error('Expected String, got '+typeof c);}
		return isAlpha(c)||isDigit(c);
	}
	
	function isAddop(c) {
		if (typeof c!=='string') {throw new Error('Expected String, got '+typeof c);}
		return (/[+\-]/).test(c);
	}
	
	function isWhite(c) {
		if (typeof c!=='string') {throw new Error('Expected String, got '+typeof c);}
		return (/\s/).test(c);
	}
	
	function skipWhite() {
		while (isWhite(look)) {
			getChar();
		}
	}
	
	function newLine() {skipWhite();}
	
	function match(x) {
		if (look===x) {
			getChar();
			skipWhite();
		}
		else {expected("'"+x+"'");}
	}
	
	function getName() {
		if (!isAlpha(look)) {expected('Name');}
		var ret='';
		while (isAlNum(look)) {
			ret+=look;
			getChar();
		}
		skipWhite();
		return ret;
	}
	
	function getNum() {
		if (!isDigit(look)) {expected('Integer');}
		var ret='';
		while (isDigit(look)) {
			ret+=look;
			getChar();
		}
		skipWhite();
		return +ret;
	}
	
	function emit(s) {
		console.log('\t'+s);
	}
	
	function emitLn(s) {
		throw new Error('Stop using this!');
		emit(s);
	}
	
	function ident() {
		var name=getName();
		if (look==='(') {
			match('(');
			match(')');
			emitLn('BSR ' + name);
		}
		else {
			emitLn('MOVE ' + name + '(PC),D0');
		}
	}
	
	function factor() {
		var value;
		if (look==='(') {
			match('(');
			value=expression();
			match(')');
		}
		else if (isAlpha(look)) {
			value=table[getName()];
		}
		else {
			value=getNum();
		}
		return value;
	}
	
	function term() {
		var value=factor();
		
		while (/[*\/]/.test(look)) {
			switch (look) {
				case '*':
					match('*');
					value*=factor();
					break;
				case '/':
					match('*');
					value/=factor();
					break;
				default: expected('Mulop');
			}
		}
		return value;
	}
	
	function expression() {
		var value=0;
		if (!isAddop(look)) {value=term();}
		
		while (isAddop(look)) {
			switch (look) {
				case '+':
					match('+');
					value+=term();
					break;
				case '-':
					match('-');
					value-=term();
					break;
				default: expected('Addop');
			}
		}
		return value;
	}
	
	function assignment() {
		var name=getName();
		match('=');
		table[name]=expression();
	}
	
	function input() {
		match('?');
		var name=getName();
		prompt('Specify a value for "'+name+'"',function(err,input) {
			table[name]=+input;
		});
		return table[name];
	}
	
	function output() {
		match('!');
		console.log(table[getName()]);
	}
	
	function init() {
		getChar();
		skipWhite();
	}
	
	init();
	while (look!=='') {
		switch (look) {
			case '?': input( ); break;
			case '!': output(); break;
			default: assignment();
		}
		match('.');
		newLine();
	}
	if (look&&look!=='\n') {expected('NewLine');}
	if (string[string.length-1]!=='\n') {expected('NewLine at EOF');}
	
	if (look!=='') {
		error(
			'Invalid/Unsupported Code'
		);
	}
	console.log(JSON.stringify(table));
}(console,process,require));
