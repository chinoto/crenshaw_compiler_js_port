String.prototype.splice=function(idx,rem,str) {
	return this.slice(0,idx)+str+this.slice(idx+Math.abs(rem));
};
(function(console,process,require) {
	'use strict';
	
	var
		string=(true
				//Probably considered bad practice, but this is a single purpose script with no async tasks... yet?
				? require('fs').readFileSync('test.js','utf8')
				//For faster tweaking and testing
				: '((1+2)*3-(-3))/4'
			)
		,char_i=-1
		,look='' //lookahead Character
		,error_marker='[ERR]'
	;
	
	function getChar() {
		return look=string[++char_i]||'';
	}
	
	function error(s) {
		console.log(
			'\u0007Error: '+s+'\n'
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
		getChar();
		while (isDigit(look)) {
			ret+=look;
			getChar();
		}
		skipWhite();
		return ret;
	}
	
	function emit(s) {
		console.log('\t'+s);
	}
	
	function emitLn(s) {
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
		if (look==='(') {
			match('(');
			expression();
			match(')');
		}
		else if (isAlpha(look)) {
			ident();
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
	
	function assignment() {
		var name=getName();
		match('=');
		expression();
		emitLn('LEA ' + name + '(PC),A0');
		emitLn('MOVE D0,(A0)');
	}
	
	function init() {
		getChar();
		skipWhite();
	}
	
	init();
	assignment();
	if (look&&look!=='\n') {expected('NewLine');}
	if (string[string.length-1]!=='\n') {expected('NewLine at EOF');}
	
	if (look!=='') {
		error(
			'Invalid/Unsupported Code'
		);
	}
}(console,process,require));
