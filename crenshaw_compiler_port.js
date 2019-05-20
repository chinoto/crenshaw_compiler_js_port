(function(console,process,require) {
	'use strict';
	String.prototype.splice=function(idx,rem,str) {
		return this.slice(0,idx)+str+this.slice(idx+Math.abs(rem));
	};

	var
		string=require('fs').readFileSync('test.js','utf8')
		,char_i=-1
		,look='' //lookahead Character
		,token=''
		,value=''
		,lCount=0
		,error_marker='[ERR]'
		,kwList=['IF','ELSE','ENDIF','WHILE','ENDWHILE','READ','WRITE','VAR','BEGIN','END','PROGRAM','PROCEDURE']
		,kwCode='xileweRWvbepP'
		,stdout=process.stdout
		,inTable={}
		,params={}
		,numParams=0
		,base=0
	;

	function getChar() {
		++char_i;
		//Handle potential comment
		if (string[char_i]==='/') {
			//single line comment
			if      (string[char_i+1]==='/') {
				char_i+=2;
				//Avoid infinite loop by checking against string.length first
				while (string.length>char_i&&/[^\r\n]/.test(string[char_i])) {++char_i;}
			}
			//multiline comment
			else if (string[char_i+1]==='*') {
				//advance three characters so, by the end, char_i will be at the last
				//character ('/') of the comment, then set look to be a space so
				//comments don't join statements together
				char_i+=3;
				while (string.length>char_i&&(string[char_i-1]!=='*'||string[char_i]!=='/')) {++char_i;}
				return look=' ';
			}
		}
		return look=string[char_i]||'';
	}

	function parserDump() {
		return 'Parser dump: '+JSON.stringify({look,value,token});
	}

	function error(s) {
		throw new Error(
			'error: '+s+'\n'
			+parserDump()+'\n'
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

	function expected(s) {abort(s + ' expected.');}

	function undefinedVar(n) {abort('Undefined Identifier '+n);}

	function duplicate(n) {
		abort('Duplicate Variable Name '+n);
	}

	function checkIdent() {
		if (token!='x') {expected('Identifier');}
	}

	function matchString(x) {
		if (value!==x) {expected('"'+x+'"');}
		next();
	}

	function semi() {
		if (token===';') {next();}
	}

	function isAlpha(c) {return /[a-z]/i.test(c);}
	function isDigit(c) {return /[0-9]/.test(c);}
	function isAlNum(c) {return /[a-z0-9]/i.test(c);}
	function isBoolean(c) {return /[tf]/i.test(c);}
	function isOp(c) {return /[+\-*/<>:=]/.test(c);}
	function isAddop(c) {return /[+-]/.test(c);}
	function isMulop(c) {return /[*/]/.test(c);}
	function isOrop(c) {return /[|~]/.test(c);}
	function isRelop(c) {return /[=#<>]/.test(c);}
	function isWhite(c) {return /[ \t\r\n]/.test(c);}

	function skipWhite() {
		while (isWhite(look)) {
			getChar();
		}
	}

	function getName() {
		skipWhite();
		value='';
		if (!isAlpha(look)) {expected('Identifier');}
		do {
			value+=look.toUpperCase();
			getChar();
		} while (isAlNum(look));
		token=kwCode[lookup(value)+1];
		return value;
	}

	function getNum() {
		skipWhite();
		if (!isDigit(look)) {expected('Integer');}
		value='';
		do {
			value+=look;
			getChar();
		} while (isDigit(look));
		//Turn string into number, shouldn't actually change anything...
		value=+value;
		token='#';
		return value;
	}

	function getOp() {
		skipWhite();
		token=look;
		value=look;
		getChar();
	}

	function next() {
		skipWhite();
		if (isAlpha(look)) {getName();}
		else if (isDigit(look)) {getNum();}
		else {getOp();}
		//writeLn(parserDump());
		return true; //instead of while (cond&&(next()||true)) just while (cond&&next())
	}

	function lookup(s) {
		return kwList.indexOf(s);
	}

	function newLabel() {return 'L'+(++lCount);}

	function postLabel(L) {write(L+':');}

	function emit(s) {write('\t'+s);}

	function emitLn(s) {emit(s+'\n');}

	function write(...s) {
		stdout.write(s.join(''));
	}

	function writeLn(...s) {
		write(...s,'\n');
	}

	//This is different from Crenshaw's impl in that it eliminates the need for
	//negFactor, firstFactor, firstTerm, and term1, making the code much less
	//windy and confusing.
	function factor() {
		var neg=false;
		while (/[+-]/.test(token)) {
			if (token==='-') {neg=!neg;}
			next();
		}
		if (token === '(') {
			next();
			boolExpression();
			matchString(')');
			if (neg) {negate();}
		}
		else {
			if (token==='x') {
				if (isParam(value)) {loadParam(params[value]);}
				else {loadVar(value);}
				if (neg) {negate();}
			}
			else if (token==='#') {
				loadConst((neg ? -1 : 1)*value);
			}
			else {expected('Math factor');}
			next();
		}
	}

	function multiply() {
		next();
		factor();
		popMul();
	}

	function divide() {
		next();
		factor();
		popDiv();
	}

	function term() {
		factor();
		while (isMulop(token)) {
			push();
			switch (token) {
				case '*': multiply(); break;
				case '/': divide(); break;
			}
		}
	}

	function add() {
		next();
		term();
		popAdd();
	}

	function subtract() {
		next();
		term();
		popSub();
	}

	function expression() {
		term();
		while (isAddop(token)) {
			push();
			switch (token) {
				case '+': add(); break;
				case '-': subtract(); break;
			}
		}
	}

	function compareExpression() {
		boolExpression();
		popCompare();
	}

	function nextExpression() {
		next();
		compareExpression();
	}

	function boolTerm() {
		notFactor();
		while (token === '&') {
			push();
			next();
			notFactor();
			popAnd();
		}
	}

	function notFactor() {
		if (token === '!') {
			next();
			relation();
			notIt();
		}
		else {
			relation();
		}
	}

	function boolOr() {
		next();
		boolTerm();
		popOr();
	}

	function boolXor() {
		next();
		boolTerm();
		popXor();
	}

	function boolExpression() {
		boolTerm();
		while (isOrop(token)) {
			push();
			switch (token) {
				case '|': boolOr(); break;
				case '~': boolXor(); break;
			}
		}
	}

	function doProc() {
		let name=getName();
		next();
		checkDup(name);
		inTable[name]='p';
		formalList();
		var k=locDecls();
		procProlog(name,k)
		matchString('BEGIN');
		block();
		matchString('END');
		procEpilog();
		clearParams();
	}

	function formalList() {
		matchString('(');
		if (token!==')') {
			do {
				checkIdent();
				addParam(value);
				next();
			} while (token===','&&next());
		}
		matchString(')');
		base=numParams;
		numParams+=4
	}

	function addParam(name) {
		if (isParam(name)) {duplicate(name);}
		++numParams;
		params[name]=numParams;
	}

	function isParam(name) {
		return params.hasOwnProperty(name);
	}

	function clearParams() {
		params={};
		numParams=0;
	}

	function locDecls() {
		var n=0;
		while (token==='v') {
			do {
				addParam(getName());
				++n;
				next();
			} while (token===',');
		}
		return n;
	}

	function procProlog(name,k) {
		postLabel(name);
		emitLn('LINK A6,#'+(-2*k));
	}

	function procEpilog() {
		emitLn('UNLK A6');
		emitLn('RTS');
	}

	function loadParam(n) {
		emitLn(`MOVE ${8+2*(base-n)}(A6),D0`);
	}

	function storeParam(n) {
		emitLn(`MOVE D0,${8+2*(base-n)}(A6)`);
	}

	function doIf() {
		var L1, L2;
		next();
		boolExpression();
		L1=newLabel();
		L2=L1;
		branchFalse(L1);
		block();
		if (token==='l') {
			next();
			L2=newLabel();
			branch(L2);
			postLabel(L1);
			block();
		}
		postLabel(L2);
		matchString('ENDIF');
	}

	function doWhile() {
		next();
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

	function equals() {
		nextExpression();
		setEqual();
	}

	function notEqual() {
		nextExpression();
		setNEqual();
	}

	function less() {
		next();
		switch (token) {
			case '=': lessOrEqual(); break;
			case '>': notEqual(); break;
			default:
				compareExpression();
				setLess();
		}
	}

	function greater() {
		next();
		var orEqual=false;
		if (token==='=') {next();orEqual=true;}
		compareExpression();
		if (orEqual) {setGreaterOrEqual();} else {setGreater();}
	}

	function lessOrEqual() {
		nextExpression();
		setLessOrEqual();
	}

	function relation() {
		expression();
		if (isRelop(token)) {
			push();
			switch (token) {
				case '=': equals();    break;
				case '<': less();      break;
				case '>': greater();   break;
				default: writeLn('Should this happen?');
			}
		}
	}

	function assignOrProc() {
		var name=value;
		switch (isParam(name) ? 'f' : inTable[name]) {
			case 'v':
			case 'f': assignment(name); break;
			case 'p': callProc(name); break;
			default: undefinedVar(name);
		}
	}

	function assignment(name) {
		next();
		matchString('=');
		boolExpression();
		if (isParam(name)) {storeParam(params[name]);}
		else {store(name);}
	}

	function callProc(name) {
		next();
		var n=paramList();
		emitLn('BSR '+name);
		if (n>0) {
			emitLn(`ADD #${n},SP`);
		}
	}

	function paramList() {
		var n=0;
		matchString('(');
		if (token!==')') {
			do {
				param();
				++n;
			} while (token===','&&next());
		}
		matchString(')');
		return 2*n;
	}

	function param() {
		boolExpression();
		push();
	}

	function block() {
		while (/[^el]/.test(token)) {
			switch (token) {
				case 'i': doIf(); break;
				case 'w': doWhile(); break;
				case 'R': doRead(); break;
				case 'W': doWrite(); break;
				case 'P': doProc(); break;
				default: assignOrProc();
			}
			semi();
		}
	}

	function header() {
		writeLn('WARMST', '\t', 'EQU $A01E');
	}

	function topDecls() {
		while (true) { //v or P
			if (token==='v') {
				do {alloc();} while (token===',');
			}
			else if (token==='P') {doProc();}
			else {break;}
			semi();
		}
	}

	function checkTable(n) {
		if (!inTable.hasOwnProperty(n)) {undefinedVar(n);}
	}

	function checkDup(n) {
		if (inTable.hasOwnProperty(n)) {duplicate(n);}
	}

	function alloc() {
		next();
		if (token!=='x') {expected('Variable Name');}
		var name=value;
		checkDup(name);
		inTable[name]='v';
		var val=0;
		if (look==='=') {
			next();
			var isNeg=false;
			if (look==='-') {
				isNeg=true;
				next();
			}
			val=getNum()*(isNeg ? -1 : 1);
		}
		allocate(name,val);
		next();
	}

	function allocate(name, val) {
		writeLn(name, ':\tDC ', val);
	}

	function prolog() {
		postLabel('MAIN');
	}

	function epilog() {
		emitLn('DC WARMST');
		emitLn('END MAIN');
	}

	function init() {
		getChar();
		next();
	}

	//Assembly implementations
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
		checkTable(name)
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
		checkTable(name);
		emitLn('LEA '+name+'(PC),A0');
		emitLn('MOVE D0,(A0)');
	}

	function readVar() {
		checkIdent()
		checkTable(value);
		readIt(value)
		next();
	}

	function doRead() {
		next();
		matchString('(');
		do {
			readVar();
		} while (token===','&&next());
		matchString(')');
	}

	function doWrite() {
		next();
		matchString('(');
		do {
			expression();
			writeIt();
		} while (token===','&&next());
		matchString(')');
	}

	function readIt(name) {
		emitLn('BSR READ');
		store(name);
	}

	function writeIt() {
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
	header();
	topDecls();
	matchString('PROGRAM');
	matchString('BEGIN');
	prolog();
	block();
	matchString('END');
	epilog();
}(console,process,require));
