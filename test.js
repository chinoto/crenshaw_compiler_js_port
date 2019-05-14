var num,result

PROCEDURE factorial(num)
var a,b //Just for testing
BEGIN
	a=1
	b=2
	result=result*num
	if num>1 factorial(num-1) endif
END

PROGRAM BEGIN
	read(num)
	result=1
	factorial(num)
	write(result)
END
