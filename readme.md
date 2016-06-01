# Crenshaw's Compiler Ported to Javascript
# by [Damian J Pound] (aka Chinoto Vokro)

## Story Time!
### Why?!? ... Why not?
I wanted to compile (or [transpile][Transpiler] rather?) programs to [Expression 2] (pretty much for the hell of it), and I've always thought [LLVM] was rather interesting, so I decided I would try building a backend for it.
But before I could even contemplate doing that, I thought it would be good to learn how to build a basic compiler first so I cover all the basic knowledge (even if I don't need it, it's good to understand things).

### The Search Begins
The only languages I already knew well were PHP and Javascript, so I went with JS because I thought it would be fun to learn [NodeJS] and use a [dynamically typed], [interpreted], [scripting] language [originally designed for browsers][Javascript History] to bother people who think compilers shouldn't be written with this kind of language :P.
I looked around for information about writing a compiler and found [this Reddit-like thread][YCombinator Thread] on a site called YCombinator, which led me to [Crenshaw's tutorial][Crenshaw Tutorial].

### Good Intentions
I intended for my basic compiler to be something that took E2 code and turned it into an executable that would use commandline arguments as @inputs (`> ./adder.e2 1 2`), do a single execution, and echo the @outputs in JSON format (`{"result":3}`), maybe even implement things like runOnTick() so you could have something that can run continuously.
But now I'm apparently writing a Pascal compiler, which I know nothing about... WOOHOO!

### Back To The Present (about a week after **The Search Begins**)
At the moment (2016-06-01), I've gotten done with page 2 and I figure I should publicize my progress on Github so I have something to show off besides my recent XHTML compatibility fixes to other projects (which were very simple), maybe get some criticism, and potentially help others wanting to learn how to build a compiler.
So far it's just been copy/pasting the code, attempting to understand it, translating it to javascript, running JSLint until it's mostly happy (it rarely likes code entirely), fixing a few minor errors in translation, and seeing what I can feed it at this stage then observing and mentally processing the output to see if it matches the input.
I've seen Markdown used in the READMEs of other repositories and it's rather nice to have the simplicity forced on you, reminds me of the concept "[Separation of Concerns](https://en.wikipedia.org/wiki/Separation_of_concerns)".

## Extraneous Stuff
Markdown assistance provided by [Dillinger]

[Damian J Pound]: <http://members.thebestisp.com/~damian/>
[Transpiler]: <https://en.wikipedia.org/wiki/Source-to-source_compiler>
[Expression 2]: <http://wiki.wiremod.com/wiki/Expression_2>
[LLVM]: <http://llvm.org/>
[NodeJS]: <https://nodejs.org/en/>
[YCombinator Thread]: <https://news.ycombinator.com/item?id=2927784>
[Crenshaw Tutorial]: <http://compilers.iecc.com/crenshaw/>
[Dillinger]: <http://dillinger.io/>

[#]: < Nonsense about using javascript instead of a typical compiler language. >
[dynamically typed]: <https://en.wikipedia.org/wiki/Programming_language#Static_versus_dynamic_typing>
[interpreted]: <https://en.wikipedia.org/wiki/Interpreted_language>
[scripting]: <https://en.wikipedia.org/wiki/Scripting_language>
[Javascript History]: <https://en.wikipedia.org/wiki/JavaScript#History>
