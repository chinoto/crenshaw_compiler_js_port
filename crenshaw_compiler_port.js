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
		,kwList=['IF','ELSE','ENDIF','WHILE','ENDWHILE','READ','WRITE','BYTE','WORD','LONG','BEGIN','END','PROGRAM','PROCEDURE']
		,kwCode='xiLereRWbwlBepP'
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
	function isVarType(c) {return /[bwl]/.test(c);}

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
		let type;
		while (/[+-]/.test(token)) {
			if (token==='-') {neg=!neg;}
			next();
		}
		if (token === '(') {
			next();
			type=boolExpression();
			matchString(')');
			if (neg) {negate();}
		}
		else {
			if (token==='x') {
				if (isParam(value)) {type=loadParam(params[value]);}
				else {type=loadVar(value);}
				if (neg) {negate();}
			}
			else if (token==='#') {
				type=loadConst((neg ? -1 : 1)*value);
			}
			else {expected('Math factor');}
			next();
		}
		return type;
	}

	function multiply(t1) {
		next();
		return popMul(t1,factor());
	}

	function divide(t1) {
		next();
		return popDiv(t1,factor());
	}

	function term() {
		let type=factor();
		while (isMulop(token)) {
			push(type);
			switch (token) {
				case '*': type=multiply(type); break;
				case '/': type=divide(type); break;
			}
		}
		return type;
	}

	function add(t1) {
		next();
		return popAdd(t1,term());
	}

	function subtract(t1) {
		next();
		return popSub(t1,term());
	}

	function expression() {
		let type=term();
		while (isAddop(token)) {
			push(type);
			switch (token) {
				case '+': type=add(type); break;
				case '-': type=subtract(type); break;
			}
		}
		return type;
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
		let type=notFactor();
		while (token === '&') {
			push();
			next();
			notFactor();
			popAnd();
		}
		return type;
	}

	function notFactor() {
		let type;
		if (token === '!') {
			next();
			type=relation();
			notIt();
		}
		else {
			type=relation();
		}
		return type;
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

	/*
	This is an incomplete listing of functions called by boolExpression and its
	descendants to make the flow easier to follow.

	boolExpression: boolTerm boolOr boolXor
	boolTerm: notFactor popAnd
	notFactor: relation notIt
	relation: expression equals less greater
	expression: term add subtract
	term: factor multiply divide
	factor: boolExpression loadVar loadParam loadConst
	*/
	function boolExpression() {
		let type=boolTerm();
		while (isOrop(token)) {
			push(type);
			switch (token) {
				case '|': type=boolOr(type); break;
				case '~': type=boolXor(type); break;
			}
		}
		return type;
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
		if (token==='L') {
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
		let type=expression();
		if (isRelop(token)) {
			push();
			switch (token) {
				case '=': equals();    break;
				case '<': less();      break;
				case '>': greater();   break;
				default: writeLn('Should this happen?');
			}
		}
		return type;
	}

	function assignOrProc() {
		var name=value;
		switch (isParam(name) ? 'f' : inTable[name]) {
			case 'b':
			case 'w':
			case 'l':
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
				case 'r': doWhile(); break;
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
			if (isVarType(token)) {
				let type=token;
				do {alloc(type);} while (token===',');
			}
			else if (token==='P') {doProc();}
			else {break;}
			semi();
		}
	}

	function varType(n) {
		if (!inTable.hasOwnProperty(n)) {undefinedVar(n);}
		if (!isVarType(inTable[n])) {abort(`Identifier '${n}' is recorded as a ${inTable[n]}, not a variable`);}
		return inTable[n];
	}

	function checkDup(n) {
		if (inTable.hasOwnProperty(n)) {duplicate(n);}
	}

	function alloc(type) {
		next();
		if (token!=='x') {expected('Variable Name');}
		var name=value;
		checkDup(name);
		inTable[name]=type;
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
		allocate(name,val,type);
		next();
	}

	function allocate(name, val, type) {
		writeLn(`${name}:\tDC.${type} ${val}`);
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

	function move(type, src, dest) {
		emitLn(`MOVE.${type} ${src},${dest}`);
	}

	function convert(src, dest, reg) {
		if (src!==dest) {
			if (src==='b') {emitLn('AND.W #$FF,'+reg);}
			if (dest==='l') {emitLn('EXT.L '+reg);}
		}
	}

	function promote(t1, t2, reg) {
		let type=t1;
		if (t1!==t2&&(t1==='b'||(t1==='w'&&t2==='l'))) {
			convert(t1,t2,reg);
			type=t2;
		}
		return type;
	}

	function sameType(t1,t2) {
		t1=promote(t1,t2,'D7');
		return promote(t2,t1,'D0');
	}

	function negate() {
		emitLn('NEG D0');
	}

	function loadConst(n) {
		let absN=Math.abs(n);
		let type;
		if (absN<=127) {type='b'}
		else if (absN<=32767) {type='w'}
		else {type='l'}
		move(type,'#'+n,'D0');
		return type;
	}

	function loadVar(name) {
		let type=varType(name);
		move(type, name+'(PC)', 'D0');
		return type;
	}

	function push(type) {
		move(type, 'D0', '-(SP)');
	}

	function pop(type) {
		move(type, '(SP)+', 'D7');
	}

	function popAdd(t1,t2) {
		pop(t1);
		t2=sameType(t1,t2);
		emitLn(`ADD.${t2} D7,D0`);
		return t2;
	}

	function popSub(t1,t2) {
		pop(t1);
		t2=sameType(t1,t2);
		emitLn(`SUB.${t2} D7,D0`);
		emitLn('NEG D0');
		return t2;
	}

	function popMul(t1,t2) {
		pop(t1);
		let t=sameType(t1,t2);
		convert(t,'w','D7');
		convert(t,'w','D0');
		if (t==='l') {emitLn('JSR MUL32');}
		else {emitLn('MULS D7,D0');}
		return (t==='b' ? 'w' : 'l');
	}

	function popDiv(t1,t2) {
		pop(t1);
		convert(t1,'l','D7');
		if (t1==='l'||t2==='l') {
			convert(t2,'l','D0');
			emitLn('JSR DIV32');
			return 'l';
		}
		else {
			convert(t2,'w','D0');
			emitLn('DIVS D0,D7');
			move('w','D7','D0');
			return t1
		}
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

	function store(name,t1) {
		let t2=varType(name);
		convert(t1,t2,'D0');
		emitLn('LEA '+name+'(PC),A0');
		move(t2, 'D0','(A0)');
	}

	function readVar() {
		checkIdent();
		varType(value);
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
