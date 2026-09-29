<!-- autoi18n: source=pedagogy-basics.md lang=en sha1=fe99ab1fc65e5aaa63b9009fd252a091e57cbc51 -->
# Pedagogy for Those Who Teach "Simply About the Complex"

### A summary of the basic theory of pedagogical faculties — applicable to teaching programming and IT to children

This is not a list of tips or life hacks, but rather the structure of the learning process itself. At pedagogical faculties, this is spread over several courses: developmental psychology, theory of learning, didactics, assessment. Here, it is the same — in one text and with a focus on teaching IT to children based on the principle of "simply about the complex." As you read, it will become clear that this approach has a strict scientific basis, which is named below.

---

## 1. Where Knowledge in the Mind Comes From

All learning theories answer one question: what happens at the moment when a person begins to understand something. Historically, there have been four answers, and each subsequent one did not negate the previous one but clarified it.

**Behaviorism** (Skinner) — the oldest and coarsest view: learning is the reinforcement of a response through reinforcement. Did it right — got praised, repeated it — it was reinforced. In its pure form, it is not suitable for programming: a child is not "trained" to write code; they must understand what is happening. But one element of behaviorism works in every lesson — precise reinforcement: praising a specific action, not the child in general ("I like that you checked the code first").

**Cognitivism** — the next step: the brain is viewed as an information processing system with limited capacity. Hence, working memory, which holds about four to seven units simultaneously (Miller's effect), and this is also why you cannot dump ten new concepts on a child in ten minutes. Not because they are "stupid," but because any person, including an adult, has a physically limited capacity for what can be held in mind at the same time. Below, this will become a separate, most important topic — cognitive load.

**Constructivism** (Piaget) — knowledge is not poured into the head but constructed by the student themselves through interaction with the material. A child does not "receive" the concept of working memory — they build it themselves, relying on what they already know: table, cabinet, workspace. The analogy "working memory is a table, disk is a cabinet" works not because it is beautiful, but because it gives the child the bricks from which they build a new concept on top of the old one.

**Constructivism** (Seymour Papert, a student of Piaget, creator of the Logo language and turtle graphics — a direct ancestor of children's programming) is the most important point for an IT teacher. Papert went further than Piaget: knowledge is built best when a child creates something external and tangible — a program, a drawing, a mechanism — and sees whether it works or not. The computer in his theory is the ideal tool precisely because it provides instant honest feedback: the code either works or it doesn't, and the child sees it for themselves, without the teacher's assessment. This is a direct theoretical justification for why game models ("Living Computer," where children play the roles of parts of a computer), projects in Scratch, and the principle of "write and run" work better than any retelling of theory without practice.

---

## 2. What a child can understand at 9 and 14 years old

Here, Piaget's developmental psychology is important — not for memorizing stages, but because it directly explains why analogies are needed.

Until about 11–12 years old, a child is at the stage of **concrete operations**: they reason logically, but only about things they can physically represent — touch, see, sort. Abstract symbols by themselves (a variable like "x," reasoning "if only") are difficult to grasp.

After 11–12 years old, the stage of **formal operations** gradually kicks in: the ability to reason about the abstract without relying on a concrete image, to think in hypotheses, to operate with symbols.

In a group of 9–14 year olds, children at different stages are sitting together. Hence, the direct conclusion: **metaphor is not a simplification for the young, but a bridge between concrete and abstract thinking, needed by all**. Younger children need it as support, older ones — as a quick entry into the topic. "A switch as the simplest computer" or "a grain instead of a transistor" is exactly what developmental theory requires at this age: to give an abstract idea (binary logic, billions of transistors) a physical form that can be imagined. This is not a simplification of content, but the correct format for its presentation for the brain at this age.

---

## 3. Zone of Proximal Development — where learning occurs

Lev Vygotsky introduced a concept that is essential for any teacher training program: **zone of proximal development**.

A child has what they can already do independently. There are things they cannot do even with help. And between them is the zone of what they cannot yet do alone, but can do with the support of a teacher. It is in this zone that learning occurs — not below (boring, already knows) and not above (useless, too early).

Hence the concept of **scaffolding**: the teacher provides just enough support as needed right now and removes it as the child manages on their own. A classic technique is the "melting example": full example → example with gaps → half-empty example → blank sheet. The child is not thrown into cold water immediately and is not held by the hand forever — the teacher constantly feels out their current zone of proximal development and works precisely within it.

Practical conclusion: if the task is solved by everyone in 2 minutes — it was below the zone, it's boring. If no one has moved after 10 minutes — it was above the zone, a hint or breakdown into subtasks is needed.

---

## 4. Cognitive Load — the most practical theory of all

John Sweller formulated the **Cognitive Load Theory** — today, perhaps the most influential and testable theory in the didactics of exact sciences and programming. It explains how to prevent the "brain from boiling over."

Working memory is a bottleneck through which all new information passes before settling into long-term memory. It has a strict limit. The load on it can be of three types:

**Intrinsic load** — the complexity of the material itself. Understanding what a binary system is objectively requires certain mental efforts, and this cannot be compressed without losing essence.

**Extraneous load** — what the brain wastes due to poor presentation: convoluted explanations, unnecessary details, unfortunate order of presentation. This is the only type of load that the teacher must combat.

**Germane load** — efforts that go directly into building understanding and transferring it to long-term memory.

The task of a good explanation is not to "simplify" the material (this reduces intrinsic load and impoverishes content), but to **reduce extraneous load to zero**, freeing up space for intrinsic load. This is what a successful metaphor does: it does not simplify the content, but removes the noise around it. "Working memory is a table on which lies what you are working with right now" does not simplify the structure of memory — it immediately provides a ready-made structure onto which technical details can be hung, instead of building this structure from scratch in the middle of a lesson.

From this, the rhythm of presentation "block about 10 minutes → pause": the pause is not a break for the sake of a break, but a time during which working memory has time to unload into long-term memory before a new portion comes in.

## 5. Direct Instruction vs. Discovery Learning

This is one of the loudest and still most contentious debates in global pedagogy: to present material directly or to lead children to independent discovery.

In 2006, Paul Kirschner, John Sweller, and Richard Clark published an article with the telling title **"Why Minimal Guidance During Instruction Does Not Work"** — an analysis of decades of research on "discovery learning," where students are given material and asked to figure everything out on their own. The conclusion is consistently repeated in dozens of studies: **for novices in the subject, direct, structured explanation works significantly better than independent discovery**. A novice does not have the structure in long-term memory to attach what they find to — and they either do not find what is needed or find incorrect information and remember the mistake.

An important clarification — **the expertise reversal effect**: as a student's experience grows, direct guidance becomes less necessary and at some point starts to hinder, slowing down those who are already capable of figuring things out on their own. Therefore, the balance of "I explain myself / I let them figure it out" should shift throughout the course: at the beginning — almost always direct explanation, closer to final projects — increasingly more independent work.

For novices aged 9–14, providing material immediately and completely, through clear explanation, is not a conservative but a proven more effective way than leading them to "discovery" through play. Play and practice in this scheme are not an alternative to explanation, but a way to **reinforce and test** the explanation already given.

## 6. Bloom's Taxonomy — at what level understanding occurs

Benjamin Bloom in 1956 (revised by his students in 2001) proposed a hierarchy of levels of understanding that is still used by almost any teacher training program:

**Remember** → **Understand** → **Apply** → **Analyze** → **Evaluate** → **Create**.

The practical benefit of the taxonomy is that it honestly shows: if a child has repeated the definition of the word "algorithm," that is only the first level out of six. A lesson that stops at "remember" and "understand" (which is almost inevitable in the first classes) is a normal start, but not the end. Conscious work with the taxonomy is when the teacher sees at what level their question to the class operates ("what is RAM?" — "remember"; "why is RAM faster than a disk?" — "understand"; "what will break if a computer has 1 MB of RAM?" — already "apply" and "analyze"), and consciously raises the level of questions throughout the course, not just at the end.

---

## 7. Backward Design of the Lesson

Grant Wiggins and Jay McTighe proposed the **Backward Design** model (Understanding by Design) — today a standard for lesson planning in English-speaking pedagogy. It turns the intuitive order of planning 180 degrees.

The usual order: I come up with what to engage the children in during the lesson → I conduct it → at the end, I somehow assess whether it worked.

Backward Design: **first**, it is formulated what exactly the child should be able to do after the lesson (not "cover the topic," but specifically — "explain in their own words the difference between RAM and a disk"), **then** — how this will be assessed (for example, with a short quiz), and only **after that** are the actual activities of the lesson designed as a path to this assessment.

A useful habit: before preparing a lesson, formulate in one sentence what the child should be able to do after it — and only then gather material for this goal.

## 8. Formative Assessment — the Strongest Lever of All Studied

Paul Black and Dylan Wiliam conducted one of the most cited meta-analyses in the history of education (**"Inside the Black Box"**) in the late 1990s and showed that **formative assessment** — assessment not for the sake of grading, but for adjusting learning on the go — provides one of the largest measurable effects on academic performance among all studied educational interventions.

The difference is simple. **Summative assessment** — a test at the end of a module: it marks a point, nothing can be corrected. **Formative assessment** — any immediate signal during the lesson about who understood and who did not, used right away to adjust the delivery. A quiz with answer options in the middle of a lesson is not a "knowledge check" in the usual sense, but feedback for the teacher: if half the class made a mistake, there is no need to proceed with the plan — it is necessary to go back and explain differently. The Peer Instruction method (everyone answers individually → discusses the answer with a neighbor → answers again) is formative assessment taken to a separate technique.

---

## 9. Motivation: Why You Should Praise the Action, Not the Child

Carol Dweck (Stanford) popularized the concept of **growth mindset** in contrast to **fixed mindset**. Children who are praised for innate intelligence ("you are smart") tend to avoid challenging tasks over time — they fear losing the image of being "smart." Children who are praised for the process and effort ("you found a good way to test the code before running it") are more willing to tackle difficult tasks: failure does not threaten their self-esteem, it is simply part of the process.

Edward Deci and Richard Ryan (**self-determination theory**) reached a similar conclusion from a different angle: sustainable intrinsic motivation rests on three pillars — **autonomy** (I choose myself, not being controlled), **competence** (I am genuinely growing, and it is visible), and **relatedness** (I am part of a group, I am seen). In practice, this means: giving children at least some choice within the task (what example to come up with, what color to choose for their project), making progress visible (not an abstract grade, but a specific "now you can explain what you couldn't a month ago"), and creating moments where children see and support each other — for example, through teamwork.

## 10. The Testing Effect and Spaced Repetition — How Memory Works

Children of this age have excellent memory, and this is one of the reasons to present the material in full. But memory has mechanics that are worth knowing to ensure that the material truly sticks and does not fade away after a week.

Henry Roediger and his colleagues have studied the **testing effect** for many years: the attempt to recall information strengthens memory more than re-reading or listening to the same material. Paraphrasing, answering an unexpected question, trying to recall the previous lesson without hints — all of this is not only a check of what has been learned but also a powerful tool for learning in itself. A simple technique: start the lesson by having the children recall the material from the last class before the teacher introduces something new.

Robert Bjork introduced the concept of **desirable difficulties**: what seems like a "more difficult" way of presenting — not giving the ready answer immediately, making them recall it themselves, spacing out repetition over time instead of three repetitions in a row in one lesson — creates a more durable memory than an easy, smooth path. A practical takeaway for a long course: a brief return to the material from last month ("who remembers how RAM differs from a disk?"), integrated into the new topic, works better than relying on the idea that once given, information will remain forever.

---

## 11. Differentiation — One Class, Different Speeds

Carol Tomlinson systematized the approach of **differentiated instruction**: the goal of learning is the same for everyone, but the path, pace, and level of support are different — without explicitly dividing the class into "advanced" and "struggling" (which in itself undermines motivation and a growth mindset).

In practice, for a group of 9–14 year-olds, this means: an additional task for those who finish earlier is not a "reward for speed," but a natural continuation of the same goal at a higher level of Bloom's taxonomy (not just applying, but analyzing or creating); and for those who are stuck — a hint, not a ready answer: the same principle of the zone of proximal development, applied individually right during the lesson. 

---

## 12. Classroom management is also didactics, not discipline

Jacob Kounin, studying hundreds of hours of real lessons, introduced the concept of **withitness**: the ability of a teacher to notice an emerging problem before it becomes a problem, without interrupting the main flow of the lesson. His key conclusion diverges from the intuition of many novice teachers: **the best classroom management is not a reaction to a violation, but a structure of the lesson in which there is no chance for a violation to arise**: clear transitions between blocks, rules and roles that are understandable to all, and the absence of downtime when part of the children does not know what to do. A signal for attention, a pre-thought-out "what those who are not at the board are occupied with" — these are tools of the same order as a good explanation of the material. A ready practical scheme is in the material [“Lesson Modes”](/dashboard/methodology/02-classroom/lesson-modes).

---

## 13. Metacognition — teaching a child to think about their thinking

John Flavell introduced the term **metacognition**: the ability to consciously notice what I have understood and what I have not, and how I am solving a problem. This is a teachable skill in itself that significantly accelerates all other learning. The "rubber duck" technique — asking a child to verbalize their thought process out loud — is training in metacognition: often they themselves, without the teacher's hint, find inconsistencies. The same applies to understanding the topic: asking them to explain to a neighbor in their own words what operational memory is — and the child will notice the boundary between "I learned this term" and "I really understand this." 

---

## How it comes together in "Simply Complex"

In short once again: Papert's constructivism explains why learning through code and projects works better than retelling theory. Piaget explains why, at ages 9-14, metaphor is not a simplification but a necessary bridge to abstraction. Vygotsky provides the concept of the zone in which growth actually occurs. Sweller explains the mechanism—why a good metaphor does not simplify the content but removes the noise around it, freeing working memory for the essence. Kirschner, Sweller, and Clark provide scientific justification: for beginners, clear direct explanation is more effective than leading to discovery through play. Bloom shows where to grow—from memorization to creation. Wiggins and McTighe teach to plan from the outcome, not from activity. Black and Wiliam prove that immediate feedback during the lesson is stronger than any test. Dweck, Deci, and Ryan explain how to praise so as not to discourage the desire to try. Roediger and Bjork—how to make material stick in memory. Tomlinson—how to teach different children towards one goal. Kunin—how order is built by the structure of the lesson, not by shouting. Flavell—how awareness of one's understanding accelerates understanding itself.

"Simply Complex" is not a rejection of depth and not a simplification of content. It is a combination of constructivism, cognitive load theory, and direct structured learning—precisely the combination that modern research in teaching exact sciences and programming calls the most effective for beginners.
