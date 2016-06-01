(function(console,process,require) {
	'use strict';
	
	var
		string=(true
				//Probably considered bad practice, but this is a single purpose script with no async tasks... yet?
				? require('fs').readFileSync('test.js','utf8')
				//For faster tweaking and testing
				: '((1+2)*3-(-3))/4'
			).replace(/\s/g,'').split('')
		,char_i=-1
		,tab='\t'
		,look='' //lookahead Character
	;
	
	function getChar() {
		return look=string[++char_i];
	}
	
	function error(s) {
		console.log('\u0007Error: '+s+'.');
	}
	
	function abort(s) {
		error(s);
		process.exit(-1);
	}
	
	function expected(s) {
		abort(s+' Expected');
	}
	
	function match(x) {
		if (look===x) {getChar();}
		else {expected("'"+x+"'");}
	}
	
	function isAlpha(c) {
		return (/[a-z]/i).test(c);
	}
	
	function isDigit(c) {
		return (/[0-9]/).test(c);
	}
	
	function getName() {
		if (!isAlpha(look)) {expected('Name');}
		var ret=look;
		getChar();
		return ret;
	}
	
	function getNum() {
		if (!isDigit(look)) {expected('Integer');}
		var ret=look;
		getChar();
		return ret;
	}
	
	function emit(s) {
		console.log(tab+s);
	}
	
	function emitLn(s) {
		emit(s);
	}
	
	function init() {
		getChar();
	}
	
	function factor() {
		if (look==='(') {
			match('(');
			expression();
			match(')');
		}
		else {
			emitLn('MOVE #'+getNum()+',D0');
		}
	}
	
	function multiply() {
		match('*');
		factor();
		emitLn('MULS (SP)+,D0');
	}
	
	function divide() {
		match('/');
		factor();
		emitLn('MOVE (SP)+,D1');
		emitLn('DIVS D1,D0');
	}
	
	function term() {
		factor();
		while (/[*\/]/.test(look)) {
			emitLn('MOVE D0,-(SP)');
			switch (look) {
				case '*': multiply(); break;
				case '/': divide(); break;
				default: expected('Mulop');
			}
		}
	}
	
	function add() {
		match('+');
		term();
		emitLn('ADD (SP)+,D0');
	}
	
	function subtract() {
		match('-');
		term();
		emitLn('SUB (SP)+,D0');
		emitLn('NEG D0');
	}
	
	function isAddop(c) {
		return (/[+\-]/).test(c);
	}
	
	function expression() {
		if (isAddop(look)) {emitLn('CLR D0');}
		else {term();}
		
		while (isAddop(look)) {
			emitLn('MOVE D0,-(SP)');
			switch (look) {
				case '+': add(); break;
				case '-': subtract(); break;
				default: expected('Addop');
			}
		}
	}
	
	init();
	expression();
}(console,process,require));
