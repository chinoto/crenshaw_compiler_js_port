PROGRAM //Why do I need this?
	var num,result=1
	BEGIN
		/*
		This program reads a number into num and
		computes the factorial of it by multiplying
		result by num and subtracting 1 from num
		while num is 1, then writing result out.
		*/
		read(num)
		while num>1
			result=num*result
			num=num-1
		endwhile
		write(result)
	END
. //Or this?
