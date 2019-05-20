# Crenshaw's Compiler Ported to Javascript
# by [Damian J Pound] aka Chinoto Vokro

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

### Progress update (2019-03-29)
I've been a bit slow on updates to this project due to lack of motivation, but I've found motivation is practically useless compared to the "discipline first and feel good after" approach.

I've stopped using the regex transformations because most of the compiler functions are in place and it's just a matter of slight modifications, so just typing it out myself is faster. There are a lot of dead functions in my version due to changes in the compiler, I'll wait on removing those until the end in case they come back into use in later parts of the tutorial. I'm also not rearranging the code to match Crenshaw's full cradles like I did before since it is unnecessary overhead and makes seeing the changes between commits harder, besides, spaghetti looks mostly the same regardless of which way it winds.

I appreciate that this tutorial exists, but I feel like Crenshaw occasionally takes the practice of small functions too far that it becomes spaghetti code, thus harder to understand at a glance what is happening. I suppose that's just a trait of compilers; the BNF (Backus–Naur form) for the language might seem only a bit complex, but the implementation has to account for a bit more. Even so, compare my factor() implementation to his, as well as the related functions I was able to remove due to there not being any real difference between the first factor/term and ones that come after.

Atom eats trailing spaces on save, so instead of tweaking settings to keep my line breaks (space and newline in Markdown), I just settled for a gap (two newlines) between paragraphs/sentences in this README, which is probably better anyway. I have a thing for compactness...

### Progress update (2019-05-19)
"Part 13: Procedures" instructed to start over with single character tokens and a minimal cradle for supposed simplicity, which I decided against and tried grafting the changes onto the existing compiler instead. When moving on to local variables, I missed the part that said to go back to having the procedure parameters be pass-by-value, so I struggled for awhile to understand why the output didn't make sense (treating local variables as addresses). Once I had realized what I had missed, fixing it was easy and I had procedures correctly implemented along with the features accrued from past parts of the tutorial.

In the last update, I thought it would be a good idea to keep dead functions in case they were used later, but the few hundred extra lines of code and similarly named functions were causing some mental overhead, so they're gone thanks to the help of ESLint. If any of it really is helpful, I can get them back via version control.

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

[//]: # (Nonsense about using javascript instead of a typical compiler language.)
[dynamically typed]: <https://en.wikipedia.org/wiki/Programming_language#Static_versus_dynamic_typing>
[interpreted]: <https://en.wikipedia.org/wiki/Interpreted_language>
[scripting]: <https://en.wikipedia.org/wiki/Scripting_language>
[Javascript History]: <https://en.wikipedia.org/wiki/JavaScript#History>
