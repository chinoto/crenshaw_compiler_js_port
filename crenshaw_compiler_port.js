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

	function match(x) {
		newline();
		if (look!==x) {expected('"'+x+'"');}
		getChar();
		skipWhite();
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
	function isOp(c) {return /[+\-\*\/<>:=]/.test(c);}
	function isAddop(c) {return /[+\-]/.test(c);}
	function isMulop(c) {return /[\*\/]/.test(c);}
	function isOrop(c) {return /[|~]/.test(c);}
	function isRelop(c) {return /[=#<>]/.test(c);}
	function isWhite(c) {return /[ \t\r\n]/.test(c);}

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
		skipWhite();
		token='x';
		value='';
		if (!isAlpha(look)) {expected('Identifier');}
		do {
			value+=look.toUpperCase();
			getChar();
		} while (isAlNum(look));
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

	function getBoolean() {
		if (!isBoolean(look)) {expected('Boolean Literal');}
		value=/T/i.test(look);
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

	function scan() {
		if (token==='x') {token=kwCode[lookup(value)+1];}
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
				loadVar(value);
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
		if (isAddop(token)) {clear();} else {term();}
		while (isAddop(token)) {
			push();
			switch (token) {
				case '+': add(); break;
				case '-': subtract(); break;
			}
		}
	}

	function compareExpression() {
		expression();
		popCompare();
	}

	function nextExpression() {
		next();
		compareExpression();
	}

	function condition() {
		emitLn('Condition');
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

	function doRead() {
		next();
		matchString('(');
		readVar();
		while (token===',') {
			next();
			readVar();
		}
		matchString(')');
	}

	function doWrite() {
		next();
		matchString('(');
		expression();
		writeIt();
		while (token===',') {
			next();
			expression();
			writeIt();
		}
		matchString(')');
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
		nextExpression();
		setEqual();
	}

	function notEquals() {
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

	function assignment() {
		var name=value;
		checkTable(name);
		next();
		matchString('=');
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
			semi();
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
	}

	function topDecls() {
		scan();
		while (token==='v') {
			do {alloc();} while (token===',');
			semi();
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

	function checkTable(n) {
		if (!inTable.hasOwnProperty(n)) {undefinedVar(n);}
	}

	function checkDup(n) {
		if (inTable.hasOwnProperty(n)) {duplicate(n);}
	}

	function alloc(n) {
		next();
		if (token!=='x') {expected('Variable Name');}
		var name=value;
		checkDup(name);
		inTable[name]=true;
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
		getChar();
		next();
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
	matchString('PROGRAM');
	header();
	topDecls();
	matchString('BEGIN');
	prolog();
	block();
	matchString('END');
	epilog();
}(console,process,require));
