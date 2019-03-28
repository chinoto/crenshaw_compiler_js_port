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
		,kwList=['IF','ELSE','ENDIF','WHILE','ENDWHILE','READ','WRITE','VAR','BEGIN','END','PROGRAM']
		,kwCode='xileweRWvbep'
		,stdout=process.stdout
		,klass=''
		,sign=''
		,typ=''
		,inTable={}
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

	function undefinedVar(n) {abort('Undefined Identifier '+n);}

	function match(x) {
		newline();
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

	function newline() {
		while (/[\r\n]/.test(look)) {
			getChar();
			skipWhite();
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
		newline();
		value='';
		if (!isAlpha(look)) {expected('Name');}
		while (isAlNum(look)) {
			value+=look.toUpperCase();
			getChar();
		}
		skipWhite();
	}

	function getNum() {
		newline();
		if (!isDigit(look)) {expected('Integer');}
		value='';
		while (isDigit(look)) {
			value+=look;
			getChar();
		}
		//Turn string into number, shouldn't actually change anything...
		value=+value;
		token='#';
		skipWhite();
		return value;
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

	function write(...s) {
		stdout.write(s.join(''));
	}

	function writeLn(...s) {
		write(...s,'\n');
	}

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

	//This is different from Crenshaw's impl in that it eliminates the need for
	//negFactor, firstFactor, firstTerm, and term1, making the code much less
	//windy and confusing.
	function factor() {
		var neg=false;
		while (/[+-]/.test(look)) {
			if (look==='-') {neg=!neg;}
			getChar();
		}
		if (look === '(') {
			match('(');
			boolExpression();
			match(')');
			if (neg) {negate();}
		}
		else if (isAlpha(look)) {
			getName();
			loadVar(value);
			if (neg) {negate();}
		}
		else {
			loadConst((neg ? -1 : 1)*getNum());
		}
	}

	function multiply() {
		match('*');
		factor();
		popMul();
	}

	function divide() {
		match('/');
		factor();
		popDiv();
	}

	function term() {
		factor();
		while (isMulop(look)) {
			push();
			switch (look) {
				case '*': multiply(); break;
				case '/': divide(); break;
			}
		}
	}

	function add() {
		match('+');
		term();
		popAdd();
	}

	function subtract() {
		match('-');
		term();
		popSub();
	}

	function expression() {
		term();
		while (isAddop(look)) {
			push();
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
			push();
			match('&');
			notFactor();
			popAnd();
		}
	}

	function notFactor() {
		if (look === '!') {
			match('!');
			relation();
			notIt();
		}
		else {
			relation();
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
		popOr();
	}

	function boolXor() {
		match('~');
		boolTerm();
		popXor();
	}

	function boolExpression() {
		boolTerm();
		while (isOrop(look)) {
			push();
			switch (look) {
				case '|': boolOr(); break;
				case '~': boolXor(); break;
			}
		}
	}

	function doRead() {
		match('(');
		getName();
		readVar();
		while (look===',') {
			match(',');
			getName();
			readVar();
		}
		match(')');
	}

	function doWrite() {
		match('(');
		expression();
		writeVar();
		while (look===',') {
			match(',');
			expression();
			writeVar();
		}
		match(')');
	}

	function doIf() {
		var L1, L2;
		boolExpression();
		L1=newLabel();
		L2=L1;
		branchFalse(L1);
		block();
		if (token==='l') {
			L2=newLabel();
			branch(L2);
			postLabel(L1);
			block();
		}
		postLabel(L2);
		matchString('ENDIF');
	}

	function doWhile() {
		var L1, L2;
		L1=newLabel();
		L2=newLabel();
		postLabel(L1);
		boolExpression();
		branchFalse(L2);
		block();
		matchString('ENDWHILE');
		branch(L1);
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
		popCompare();
		setEqual();
	}

	function notEquals() {
		match('>');
		expression();
		popCompare();
		setNEqual();
	}

	function less() {
		match('<');
		switch (look) {
			case '=': lessOrEqual(); break;
			case '>': notEqual(); break;
			default:
				expression();
				popCompare();
				setLess();
		}
	}

	function greater() {
		match('>');
		var orEqual=false;
		if (look==='=') {match('='); orEqual=true;}
		expression();
		popCompare();
		if (orEqual) {setGreaterOrEqual();} else {setGreater();}
	}

	function lessOrEqual() {
		match('=');
		expression();
		popCompare();
		setLess();
	}

	function greaterOrEqual() {
		match('');
		expression();
		popCompare();
		setGreater();
	}

	function relation() {
		expression();
		if (isRelop(look)) {
			push();
			switch (look) {
				case '=': equals();    break;
				case '#': notEquals(); break;
				case '<': less();      break;
				case '>': greater();   break;
			}
		}
	}

	function assignment() {
		var name=value;
		match('=');
		boolExpression();
		store(name);
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
				case 'w': doWhile(); break;
				case 'R': doRead(); break;
				case 'W': doWrite(); break;
				default: assignment();
			}
			scan();
		}
	}

	function doBlock(name) {
		declarations();
		postLabel(name);
		statements();
	}

	function declarations() {
		loop: while (true) {
			switch (look) {
				case 'l': labels(); break;
				case 'c': constants(); break;
				case 't': types(); break;
				case 'v': variables(); break;
				case 'p': doProcedure(); break;
				case 'f': doFunction(); break;
				default: break loop;
			}
		}
	}

	function labels() {
		match('l');
	}

	function constants() {
		match('c');
	}

	function types() {
		match('t');
	}

	function variables() {
		match('v');
	}

	function doProcedure() {
		match('p');
	}

	function doFunction() {
		match('f');
	}

	function statements() {
		match('b');
		while (look!='e') {
			getChar();
		}
		match('e');
	}

	function doProgram() {
		block('');
		matchString('END')
		emitLn('END');
	}

	function prog() {
		matchString('PROGRAM');
		header();
		topDecls();
		main()
		match('.');
	}

	function header() {
		writeLn('WARMST', '\t', 'EQU $A01E');
		emitLn('LIB TINYLIB');
	}

	function topDecls() {
		scan();
		while (token!='b') {
			switch (token) {
				case 'v': decl(); break;
				default: abort('Unrecognized Keyword "'+value+'"');
			}
			scan();
		}
	}

	function decl() {
		getName();
		alloc(value);
		while (look===',') {
			match(',');
			getName();
			alloc(value);
		}
	}

	function alloc(n) {
		if (inTable.hasOwnProperty(n)) {abort('Duplicate Variable Name '+n);}
		inTable[n]=true;
		write(n, ':', '\t', 'DC ');
		if (look==='=') {
			match('=');
			if (look==='-') {
				write(look);
				match('-');
			}
			writeLn(getNum());
		}
		else {
			writeLn('0');
		}
	}

	function main() {
		matchString('BEGIN');
		prolog();
		block();
		matchString('END');
		epilog();
	}

	function prolog() {
		postLabel('MAIN');
	}

	function epilog(name) {
		emitLn('DC WARMST');
		emitLn('END MAIN');
	}

	function getClass() {
		if (/[axs]/.test(look)) {
			klass=look;
			getChar();
		}
		else {
			klass='a';
		}
	}

	function getType() {
		typ=' ';
		if (look==='u') {
			sign='u';
			typ='i';
			getChar();
		}
		else {
			sign='s';
		}
		if (/[ilc]/.test(look)) {
			typ=look;
			getChar();
		}
	}

	function topDecl() {
		var name=getName();
		if (look==='(') {doFunc(name);}
		else {doData(name);}
	}

	function doFunc(n) {
		match('(');
		match(')');
		match('{');
		match('}');
		if (typ===' ') {typ='i';}
		writeLn(klass, sign, typ, ' function ', n);
	}

	function doData(n) {
		if (typ===' ') {expected('Type declaration');}
		writeLn(klass, sign, typ, ' data ', n);
		while (look===',') {
			match(',');
			n=getName();
			writeLn(klass, sign, typ, ' data ', n);
		}
		match(';');
	}

	function init() {
		lCount=0;
		getChar();
		scan();
	}

	function clear() {
		emitLn('CLR D0');
	}

	function negate() {
		emitLn('NEG D0');
	}

	function loadConst(n) {
		emit('MOVE #');
		writeLn(n, ',D0');
	}

	function loadVar(name) {
		if (!inTable.hasOwnProperty(name)) {undefinedVar(name);}
		emitLn('MOVE '+name+'(PC),D0');
	}

	function push() {
		emitLn('MOVE D0,-(SP)');
	}

	function popAdd() {
		emitLn('ADD (SP)+,D0');
	}

	function popSub() {
		emitLn('SUB (SP)+,D0');
		emitLn('NEG D0');
	}

	function popMul() {
		emitLn('MULS (SP)+,D0');
	}

	function popDiv() {
		emitLn('MOVE (SP)+,D7');
		emitLn('EXT.L D7');
		emitLn('DIVS D0,D7');
		emitLn('MOVE D7,D0');
		return;

		//Code above is from part 10
		//Code below is a fixed version of code from an earlier part of the tutorial
		//being kept out of curiosity.
		emitLn('MOVE (SP)+,D1');
		//Mr. Crenshaw did this wrong
		//https://stackoverflow.com/questions/8882775/divide-divs-not-working-on-jack-crenshaws-lets-build-a-compiler
		emitLn('EXG D0,D1');
		emitLn('DIVS D1,D0');
	}

	function notIt() {
		emitLn('NOT D0');
	}

	function popAnd() {
		emitLn('AND (SP)+,D0');
	}

	function popOr() {
		emitLn('OR (SP)+,D0');
	}

	function popXor() {
		emitLn('EOR (SP)+,D0');
	}

	function popCompare() {
		emitLn('CMP (SP)+,D0');
	}

	function setEqual() {
		emitLn('SEQ D0');
		emitLn('EXT D0');
	}

	function setNEqual() {
		emitLn('SNE D0');
		emitLn('EXT D0');
	}

	function setGreater() {
		emitLn('SLT D0');
		emitLn('EXT D0');
	}

	function setLess() {
		emitLn('SGT D0');
		emitLn('EXT D0');
	}

	function setGreaterOrEqual() {
		emitLn('SLE D0');
		emitLn('EXT D0');
	}

	function setLessOrEqual() {
		emitLn('SGE D0');
		emitLn('EXT D0');
	}

	function store(name) {
		if (!inTable.hasOwnProperty(name)) {undefinedVar(name);}
		emitLn('LEA '+name+'(PC),A0');
		emitLn('MOVE D0,(A0)');
	}

	function readVar() {
		emitLn('BSR READ');
		store(value);
	}

	function writeVar() {
		emitLn('BSR WRITE');
	}

	function branch(l) {
		emitLn('BRA '+l);
	}

	function branchFalse(l) {
		emitLn('TST D0');
		emitLn('BEQ '+l);
	}

	init();
	prog();
	if (look!=='\n') {abort('Unexpected data after "."');}
}(console,process,require));
