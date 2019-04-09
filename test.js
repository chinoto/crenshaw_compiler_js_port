PROGRAM
	var num,result=1
	BEGIN
		read(num)
		while num>=1
			result=num*result
			num=num-1
		endwhile
		write(result)
	END
.
