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
		,token=''
		,value=''
		,lCount=0
		,error_marker='[ERR]'
		,kwList=['IF','ELSE','ENDIF','END']
		,kwCode='xilee'
		,stdout=process.stdout
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
		if (look!==x) {expected('"'+x+'"');}
		getChar();
		skipWhite();
	}

	function matchString(x) {
		if (value!==x) {expected('"'+x+'"');}
	}

	function isAlpha(c) {return /[a-z]/i.test(c);}
	function isDigit(c) {return /[0-9]/.test(c);}
	function isAlNum(c) {return /[a-z0-9]/i.test(c);}
	function isBoolean(c) {return /[tf]/i.test(c);}
	function isOp(c) {return /[+\-\*\/<>:=]/.test(c);}
	function isAddop(c) {return /[+\-]/.test(c);}
	function isMulop(c) {return /[\*\/]/.test(c);}
	function isOrop(c) {return /[|~]/.test(c);}
	function isRelop(c) {return /[=#<>]/.test(c);}
	function isWhite(c) {return /[ \t]/.test(c);}

	function skipWhite() {
		while (isWhite(look)) {
			getChar();
		}
	}


	function skipComma() {
		skipWhite();
		while (look===',') {
			getChar();
			skipWhite();
		}
	}

	function getName() {
		value='';
		while (/[\r\n]/.test(look)) {fin();}
		if (!isAlpha(look)) {expected('Name');}
		while (isAlNum(look)) {
			value+=look.toUpperCase();
			getChar();
		}
		skipWhite();
	}

	function getNum() {
		if (!isDigit(look)) {expected('Integer');}
		value='';
		while (isDigit(look)) {
			value+=look;
			getChar();
		}
		token='#';
		skipWhite();
	}

	function getOp() {
		if (!isOp(look)) {expected('Operator');}
		value='';
		while (isOp(look)) {
			value+=look;
			getChar();
		}
		token=(value.length===1 ? value : '?');
		skipWhite();
	}

	function getBoolean() {
		if (!isBoolean(look)) {expected('Boolean Literal');}
		value=/T/i.test(look);
		getChar();
	}

	function scan() {
		getName();
		token=kwCode[lookup(value)+1];
	}

	function lookup(s) {
		return kwList.indexOf(s);
	}

	function newLabel() {return 'L'+(++lCount);}

	function postLabel(L) {stdout.write(L+':');}

	function emit(s) {stdout.write('\t'+s);}

	function emitLn(s) {emit(s+'\n');}

	function ident() {
		getName();
		if (look === '(') {
			match('(');
			match(')');
			emitLn('BSR ' + value);
		}
		else {
			emitLn('MOVE ' + value + '(PC),D0');
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
			getNum();
			emitLn('MOVE #' + value + ',D0');
		}
	}

	function signedFactor() {
		var neg=look==='-';
		if (isAddop(look)) {
			getChar();
			skipWhite();
		}
		factor();
		if (neg) {
			emitLn('NEG D0');
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

	function term1() {
		while (isMulop(look)) {
			emitLn('MOVE D0,-(SP)');
			switch (look) {
				case '*': multiply(); break;
				case '/': divide(); break;
			}
		}
	}

	function term() {
		factor();
		term1();
	}

	function firstTerm() {
		signedFactor();
		term1();
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
		firstTerm();
		while (isAddop(look)) {
			emitLn('MOVE D0,-(SP)');
			switch (look) {
				case '+': add(); break;
				case '-': subtract(); break;
			}
		}
	}

	function condition() {
		emitLn('Condition');
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
			getBoolean();
			if (value) {
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

	function doIf() {
		var L1, L2;
		condition();
		L1=newLabel();
		L2=L1;
		emitLn('BEQ ' + L1);
		block();
		if (token==='l') {
			L2=newLabel();
			emitLn('BRA ' + L2);
			postLabel(L1);
			block();
		}
		postLabel(L2);
		matchString('ENDIF');
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
		getName();
		match('=');
		expression();
		emitLn('SUBQ #1,D0');
		emitLn('LEA ' + value + '(PC),A0');
		emitLn('MOVE D0,(A0)');
		expression();
		emitLn('MOVE D0,-(SP)');
		postLabel(L1);
		emitLn('LEA ' + value + '(PC),A0');
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
		var name=value;
		match('=');
		expression();
		emitLn('LEA ' + name + '(PC),A0');
		emitLn('MOVE D0,(A0)');
	}

	function fin() {
		if (look==='\r') {getChar();}
		if (look==='\n') {getChar();}
		skipWhite();
	}

	function block() {
		scan();
		while (/[^el]/.test(token)) {
			switch (token) {
				case 'i': doIf(); break;
				default: assignment();
			}
			scan();
		}
	}

	function doProgram() {
		block('');
		matchString('END')
		emitLn('END');
	}

	function init() {
		lCount=0;
		getChar();
	}

	init();
	doProgram();
}(console,process,require));
