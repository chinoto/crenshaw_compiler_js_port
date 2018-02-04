(function(console,process,require) {
	'use strict';
	String.prototype.splice=function(idx,rem,str) {
		return this.slice(0,idx)+str+this.slice(idx+Math.abs(rem));
	};

	var
		string=(true
				//Probably considered bad practice, but this is a single purpose script with no async tasks... yet?
				? require('fs').readFileSync('test.js','utf8')
				//For faster tweaking and testing
				: '((1+2)*3-(-3))/4'
			)
		,char_i=-1
		,look='' //lookahead Character
		,lCount=0
		,error_marker='[ERR]'
	;

	function getChar() {return look=string[++char_i]||'';}

	function error(s) {
		throw new Error(
			'error: '+s+'\n'
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

	function expected(s) {abort(s + ' expected');}

	function match(x) {
		if (look===x) {getChar();}
		else {expected('"'+x+'"');}
	}

	function isAlpha(c) {return /[a-z]/i.test(c);}
	function isDigit(c) {return /[0-9]/.test(c);}
	function isBoolean(c) {return /[tf]/i.test(c);}
	function isAddop(c) {return /[+\-]/.test(c);}
	function isOrop(c) {return /[|~]/.test(c);}
	function isRelop(c) {return /[=#<>]/.test(c);}
	function isWhite(c) {return /[ \t]/.test(c);}

	function skipWhite() {
		while (isWhite(look)) {
			getChar();
		}
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

	function getBoolean() {
		if (!isBoolean(look)) {expected('Boolean Literal');}
		var ret=/T/i.test(look);
		getChar();
		return ret;
	}

	function newLabel() {return 'L'+(++lCount);}

	function postLabel(L) {console.log(L, ':');}

	function emit(s) {console.log('\t'+s);}

	function emitLn(s) {emit(s);}

	function ident() {
		var name=getName();
		if (look === '(') {
			match('(');
			match(')');
			emitLn('BSR ' + name);
		}
		else {
			emitLn('MOVE ' + name + '(PC),D0');
		}
	}

	function factor() {
		if (look === '(') {
			match('(');
			expression();
			match(')');
		}
		else if (isAlpha(look)) {
			ident();
		}
		else {
			emitLn('MOVE #' + getNum() + ',D0');
		}
	}

	function signedFactor() {
		if (look === '+') {
			getChar();
		}
		if (look === '-') {
			getChar();
			if (isDigit(look)) {
				emitLn('MOVE #-' + getNum() + ',D0')
			}
			else {
				factor();
				emitLn('NEG D0');
			}
		}
		else {
			factor();
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
		//Mr. Crenshaw did this wrong
		//https://stackoverflow.com/questions/8882775/divide-divs-not-working-on-jack-crenshaws-lets-build-a-compiler
		emitLn('EXG D0,D1');
		emitLn('DIVS D1,D0');
	}

	function term() {
		signedFactor();
		while (/[*\/]/.test(look)) {
			emitLn('MOVE D0,-(SP)');
			switch (look) {
				case '*': multiply(); break;
				case '/': divide(); break;
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
		term();
		while (isAddop(look)) {
			emitLn('MOVE D0,-(SP)');
			switch (/[+-]/.test(look)) {
				case '+': add(); break;
				case '-': subtract(); break;
			}
		}
	}

	function boolTerm() {
		notFactor();
		while (look === '&') {
			emitLn('MOVE D0,-(SP)');
			match('&');
			notFactor();
			emitLn('AND (SP)+,D0');
		}
	}

	function notFactor() {
		if (look === '!') {
			match('!');
			boolFactor();
			emitLn('EOR #-1,D0');
		}
		else {
			boolFactor();
		}
	}

	function boolFactor() {
		if (isBoolean(look)) {
			if (getBoolean()) {
				emitLn('MOVE #-1,D0');
			}
			else {
				emitLn('CLR D0');
			}
		}
		else {
			relation();
		}
	}

	function boolOr() {
		match('|');
		boolTerm();
		emitLn('OR (SP)+,D0');
	}

	function boolXor() {
		match('~');
		boolTerm();
		emitLn('EOR (SP)+,D0');
	}

	function boolExpression() {
		boolTerm();
		while (isOrop(look)) {
			emitLn('MOVE D0,-(SP)');
			switch (look) {
				case '|': boolOr(); break;
				case '~': boolXor(); break;
			}
		}
	}

	function doIf(L) {
		var L1, L2;
		match('i');
		boolExpression();
		L1=newLabel();
		L2=L1;
		emitLn('BEQ ' + L1);
		block(L);
		if (look==='l') {
			match('l');
			L2=newLabel();
			emitLn('BRA ' + L2);
			postLabel(L1);
			block(L);
		}
		match('e');
		postLabel(L2);
	}

	function doWhile() {
		var L1, L2;
		match('w');
		L1=newLabel();
		L2=newLabel();
		postLabel(L1);
		boolExpression();
		emitLn('BEQ ' + L2);
		block(L2);
		match('e');
		emitLn('BRA ' + L1);
		postLabel(L2);
	}

	function doLoop() {
		var L1, L2;
		match('p');
		L1=newLabel();
		L2=newLabel();
		postLabel(L1);
		block(L2);
		match('e');
		emitLn('BRA ' + L1);
		postLabel(L2);
	}

	function doRepeat() {
		var L1, L2;
		match('r');
		L1=newLabel();
		L2=newLabel();
		postLabel(L1);
		block(L2);
		match('u');
		boolExpression();
		emitLn('BEQ ' + L1);
		postLabel(L2);
	}

	function doFor() {
		var L1,L2,name;
		match('f');
		L1=newLabel();
		L2=newLabel();
		name=getName();
		match('=');
		expression();
		emitLn('SUBQ #1,D0');
		emitLn('LEA ' + name + '(PC),A0');
		emitLn('MOVE D0,(A0)');
		expression();
		emitLn('MOVE D0,-(SP)');
		postLabel(L1);
		emitLn('LEA ' + name + '(PC),A0');
		emitLn('MOVE (A0),D0');
		emitLn('ADDQ #1,D0');
		emitLn('MOVE D0,(A0)');
		emitLn('CMP (SP),D0');
		emitLn('BGT ' + L2);
		block(L2);
		match('e');
		emitLn('BRA ' + L1);
		postLabel(L2);
		emitLn('ADDQ #2,SP');
	}

	function doDo() {
		var L1, L2;
		match('d');
		L1=newLabel();
		L2=newLabel();
		expression();
		emitLn('SUBQ #1,D0');
		postLabel(L1);
		emitLn('MOVE D0,-(SP)');
		block(L2);
		emitLn('MOVE (SP)+,D0');
		emitLn('DBRA D0,' + L1);
		emitLn('SUBQ #2,SP');
		postLabel(L2);
		emitLn('ADDQ #2,SP');
	}

	function doBreak(L) {
		match('b');
		emitLn('BRA ' + L);
	}

	function equals() {
		match('=');
		expression();
		emitLn('CMP (SP)+,D0');
		emitLn('SEQ D0');
	}

	function notEquals() {
		match('#');
		expression();
		emitLn('CMP (SP)+,D0');
		emitLn('SNE D0');
	}

	function less() {
		match('<');
		expression();
		emitLn('CMP (SP)+,D0');
		emitLn('SGE D0');
	}

	function greater() {
		match('>');
		expression();
		emitLn('CMP (SP)+,D0');
		emitLn('SLE D0');
	}

	function relation() {
		expression();
		if (isRelop(look)) {
			emitLn('MOVE D0,-(SP)');
			switch (look) {
				case '=': equals();    break;
				case '#': notEquals(); break;
				case '<': less();      break;
				case '>': greater();   break;
			}
		}
		emitLn('TST D0');
	}

	function assignment() {
	   var name = getName();
	   match('=');
	   boolExpression();
	   emitLn('LEA ' + name + '(PC),A0');
	   emitLn('MOVE D0,(A0)');
	}

	function fin() {
		if (look==='\r') {getChar();}
		if (look==='\n') {getChar();}
	}

	function block(L) {
		while (/[^elu]/.test(look)) {
			fin();
			switch (look) {
				case 'i': doIf(L);    break;
				case 'w': doWhile();  break;
				case 'p': doLoop();   break;
				case 'r': doRepeat(); break;
				case 'f': doFor();    break;
				case 'd': doDo();     break;
				case 'b': doBreak(L); break;
				default: assignment();
			}
			fin();
		}
	}

	function doProgram() {
		block('');
		if (look!=='e') {expected('End');}
		emitLn('END');
	}

	function init() {
		lCount=0;
		getChar();
	}

	init();
	doProgram();
}(console,process,require));
