# Timed transcript — Anthropic Just Released the New Rules of Claude Code

Source: https://www.youtube.com/watch?v=8Pg6G5h05hk
Auto-generated captions; verify against the video. 328 de-duplicated segments.

[0:00] So, Anthropic went from about

[0:02] 2,500 code changes per day in May to over

[0:04] 30,000 in September.  Lydia Helly from the

[0:06] CloudCode team just gave a talk

[0:08] about how they work now, and it

[0:09] looks very different from how

[0:11] most people still use

[0:13] CloudCode.

[0:13] We actually became managers of

[0:15] dozens of sessions.

[0:16] So I broke down her talk into five things

[0:18] you should do yourself in

[0:19] every session, what

[0:21] each of them now entails, and settings you

[0:23] can copy today.  So let's not waste

[0:25] time and get straight to the point.  So

[0:27] , the first thing we did before was

[0:29] control.  Earlier this year, a session

[0:31] on Opus 4.5 meant you followed up with

[0:32] it after it entered a query, corrected

[0:34] it, and reminded it what to do.  So people

[0:36] started filling their cloud.md files with

[0:38] lines like "IMPORTANT" and "NEVER"

[0:40] in all capital letters.  Now

[0:42] Lydia uses Opus 5.5 every day and says

[0:45] that for such powerful models, these lines are

[0:47] actually harmful.

[0:49] But with modern models, this is really not

[0:51] necessary, and it can even throw the model

[0:53] off track.  As a result, you get

[0:54] more tool calls and generally

[0:56] worse results.  So today, your

[0:58] cloud.md file should only contain what Cloud

[1:00] can't see in your code.

[1:02] So, the test for each line in your

[1:04] cloud.md is: could Cloud understand it

[1:06] by reading the code?  I run my business from a

[1:09] single folder, and in CloudCode it

[1:11] uses cloud.md as my

[1:13] roadmap, or it can use

[1:15] agent.md, which is where my business

[1:17] wiki, brand assets, financials, etc. are stored.  Cloud would be

[1:20] very difficult to just guess it from the

[1:22] files.  So, this is what remains.  And

[1:25] the coolest thing is that you don't have to

[1:26] clean it all up manually.  You can just

[1:28] brainstorm a bit with the model or

[1:30] run the /doctor prompt audit command,

[1:32] which will check your cloud.md and skills

[1:34] against the model and tell you that

[1:35] the model is no longer needed, which just

[1:37] takes up space and maybe even confuses

[1:39] it.  Now, the second question was about

[1:41] approval.  You either clicked "

[1:43] allow" on every command, or you

[1:45] dangerously skipped permissions,

[1:47] hoping for the best.

[1:49] But now we have auto mode, which is

[1:51] typical for the terminal and the

[1:54] CloudCode desktop application.  So, in automatic

[1:55] mode, there is a separate classifier that

[1:57] checks your commands, so tests and

[1:58] installations can run on their own

[2:00] , stopping only at what it is

[2:02] unsure of.  But by default it

[2:04] will only trust your current folder and

[2:05] your current repository.  So if

[2:07] you ask Claude to push something for

[2:09] testing, he will block the request to the

[2:11] deployment repository and you will

[2:13] safely commit everything again.

[2:14] You can set auto mode in your

[2:16] settings in plain English,

[2:18] and this is sent to a classifier

[2:20] that decides whether to reject or allow

[2:22] certain commands.

[2:23] You record which repositories,

[2:25] buckets, and domains you trust, as well as

[2:26] what the system is always allowed or

[2:28] strictly forbidden to do.  And if you don't

[2:30] want to write it yourself, just

[2:31] run /automode setup and it will create

[2:33] these entries based on your project and

[2:35] recent sessions.  Auto mode is also great

[2:37] at detecting these dangerous commands—much

[2:39] better than you can, especially if you're not a

[2:41] programmer and don't have a technical

[2:43] background like me.  That's why I always

[2:45] use auto mode.

[2:46] In our study, published in

[2:49] August, we compared auto mode with humans

[2:51] : only about 14% of people noticed a clearly

[2:54] dangerous command.  Auto mode blocked

[2:56] 89% of such commands, so it is much more

[2:59] effective than us.  However, approximately

[3:01] one in ten such teams still

[3:03] passed.

[3:03] Now the third point is quite interesting.  It

[3:05] concerns the ability to say "no."  Auto mode

[3:07] still misses about one in ten

[3:09] malicious commands.  Therefore, it is

[3:11] worth establishing a

[3:13] prohibition rule or "blacklist" for critically important things.  This is a hard

[3:15] limit that you put in the

[3:17] configuration file, and Claude Code checks

[3:19] it before the auto mode gets a

[3:20] vote.  Lydia has a simple test for

[3:22] what should go on this

[3:24] no-go list.

[3:25] I think it all comes down to this: if

[3:26] Claude makes one mistake, can I

[3:28] fix it?

[3:29] If Claude writes bad code, you

[3:31] can undo it.  So you can

[3:33] let the model work with that.  But

[3:34] if it deletes unsaved work or

[3:37] reads your API keys, you won't be able to

[3:39] undo it.  So, not reading the

[3:41] .env file where your keys are stored becomes a

[3:43] hard rule, not just a tip

[3:46] .  There is a big difference between asking for

[3:48] a prompt and having hard-

[3:50] coded permissions.  This is also important

[3:52] if you work with clients.  Also,

[3:54] if you use Claude Code

[3:55] more often for intellectual work, like me

[3:57] , and not constantly for creating software or

[3:58] programming, the test remains

[4:00] exactly the same.  Rewriting

[4:01] a draft with Claude is

[4:03] fine, but sending an email or

[4:04] deleting files is something you can't

[4:06] undo.  But again, the

[4:08] banning rule only sees the team, not what

[4:09] that team does.  Let's say Claude

[4:11] runs your tests.  These tests also

[4:13] run a bunch of code that you didn't write

[4:16] .

[4:16] So if one of these scripts

[4:17] is compromised, it could just

[4:19] open the same file and send

[4:21] your SSH keys to a server you've

[4:23] never heard of, right?  And even if we

[4:25] were around as people who approve of everything, to be honest

[4:27] , we would just click "

[4:29] allow" because there's no reason to say "no."

[4:31] 00:04:31.670 --> 00:04:31.680 align:start position:0%

[4:31] And that's exactly what a sandy

[4:33] environment is needed for.  You can simply type `/

[4:35] sandbox` and your computer will restrict the files the

[4:36] team can open and the

[4:38] websites it can access.

[4:40] So even a malicious package won't be able to

[4:41] access your keys.  Lydia

[4:43] also says that for very long jobs,

[4:45] she runs Claude in a cloud session, where

[4:47] it gets its own separate computer with a

[4:49] copy of your code, so your keys

[4:50] aren't even there, and it keeps

[4:52] running even if you close your

[4:53] laptop.

[4:54] This machine is disposable, but what

[4:56] leaves it is not.  That is, commit, push, or

[4:58] messages sent through the

[5:00] connector.

[5:01] You can save these ban rules

[5:02] in cloud sessions as well.  All you

[5:04] need to do is add them to your

[5:05] project, and then every session in

[5:06] the future will automatically pick them up.  By

[5:08] the way, I've compiled all these ban rules,

[5:10] auto mode settings, and all these hooks that

[5:12] I talk about in this video into a

[5:13] free guide in my

[5:15] School community, which you can access via the

[5:17] link in the description.  If Claude works for

[5:19] hours on end, you don't check

[5:21] every file at the end.  And if

[5:22] you do check, you may be wasting your time

[5:24] .  But the same query can

[5:25] lead to completely different results.

[5:27] Lydia's example is migrating your

[5:29] login system to a new API.

[5:31] So with the same request, one launch can

[5:33] migrate it but leave the old API,

[5:35] another can migrate it only for new

[5:38] logins, and a third can migrate it but

[5:40] log everyone out.

[5:41] At first glance, all three options

[5:43] look normal.  So you give

[5:45] Claude on-the-job checks that either

[5:46] pass or fail, like a test or a

[5:48] screenshot.  This way, a trigger that

[5:50] logs everyone out will be detected

[5:52] right away during the first scan, not at the

[5:54] very end when you've already spent all your

[5:56] time and tokens.

[5:57] And this, of course, doesn't just work with code.

[6:00] If Claude, for example, is writing a

[6:01] research report, a check might be

[6:02] , say, making sure that every

[6:04] statement has a reference to a source or

[6:05] that every number matches the table.  And

[6:07] again, when you do these

[6:08] checks, yes, they can be

[6:10] programmatic or predetermined, but

[6:11] they can also be a little more

[6:12] subjective.  It can simply be your

[6:14] definition of what “done” or

[6:16] “good” means, and you can

[6:18] create your own test for each task, have it

[6:20] take screenshots, you know,

[6:21] double or triple check everything.  The main thing is that

[6:23] Claude reviews his own

[6:25] output, improves it, gives himself

[6:27] feedback, and checks everything

[6:29] before giving you the first version.   It's

[6:31] also worth asking him to show the

[6:32] actual result, since you didn't

[6:34] see how it was created.

[6:35] And I always use some version of

[6:37] this in my skills, and also whenever

[6:38] I use the "slash goal" prompt—that's the

[6:40] prompt that makes Claude work

[6:41] until the end goal is actually

[6:43] achieved.  But if you have certain

[6:44] checks that need to be run every time

[6:46] , then you use hooks—these are

[6:48] small scripts that Claude Code

[6:49] runs on its own.  For example, a quick

[6:51] format check after each

[6:52] edit, tests after each

[6:53] task, or a full set of tests

[6:55] before allowing the work to be completed.  So they are

[6:57] much more programmatic and

[6:59] code-based.  And when the check fails,

[7:01] your script's exit code determines what

[7:03] Claude will do next.

[7:04] When a test fails, by default

[7:07] most tools exit with a

[7:09] code of "one", but with a code of "one"

[7:11] the task in Claude Code is still

[7:12] marked as completed.  So

[7:14] make sure your scripts

[7:16] end with the code "two", because that's what

[7:18] makes Claude go back and fix the

[7:20] error.   You

[7:20] might want to set your hooks to

[7:22] exit with a code of "two", so that Claude can't

[7:23] call the job complete until

[7:25] it actually is.  And when a session

[7:26] opens a pull request

[7:28] , your CI is triggered, and on

[7:30] Lydia's team, Claude checks in the code before anyone else

[7:32] .

[7:33] In our team, every PR is first

[7:35] reviewed by Claude, not the session that

[7:37] wrote it.  So he approaches

[7:39] this with a new context, as well as a

[7:41] separate group of agents who check

[7:43] every error he finds.

[7:44] And after that, people only check what

[7:46] really carries risks, and small things like

[7:48] documentation can be merged

[7:49] automatically after passing all

[7:51] the checks.  Now the last thing you

[7:53] do yourself is start each

[7:54] session, and that's what Anthropic is going to

[7:56] pass to the system.  So, with Claude Code

[7:58] Projects, currently available in

[7:59] beta for Pro, Max, and Ultra plans, you

[8:01] give one master session your entire

[8:02] list of tasks for the week, and it

[8:04] runs a separate session for each

[8:06] task and checks the results.  This

[8:08] works much the same way as a master

[8:10] orchestrator agent delegating tasks to

[8:11] subagents, but in a more

[8:14] project-oriented way.  It's like subagents on

[8:15] steroids.  And this list, of course, doesn't

[8:17] necessarily have to be just about code.

[8:19] It could be a report for a client, an

[8:20] analytical note, generating a bunch of

[8:22] content ideas, or writing scripts for a

[8:24] video—whatever is needed for a specific

[8:26] project.  So instead of

[8:27] juggling twelve different chats,

[8:29] you only communicate with one main one.

[8:31] At the same time, the main session does not write the code

[8:33] itself.  Here you need a model that is

[8:36] excellent at making decisions and

[8:37] evaluating results—like Fable.

[8:40] In the project settings, you can even

[8:42] choose which model will be the coordinator

[8:44] or orchestrator, for example, Fable 3.5,

[8:46] the latest Anthropic model at the moment

[8:48] .  And to perform the work itself in each

[8:50] separate thread, that is, in small

[8:51] subagents, you can use something

[8:53] like Opus 3.5.  So, the main

[8:55] conclusion: the old ways of working are still

[8:57] relevant, but now they have taken

[8:59] a lot of the routine off you, and everything happens much more

[9:01] automatically.  The key is to make sure

[9:03] you don't give these super-powered models

[9:05] too many instructions and don't interfere with their

[9:07] work.  You have to let them

[9:08] do what they were created

[9:10] and trained to do.

[9:11] Almost everything we used to do ourselves is

[9:13] now done by either a model, a

[9:14] toolkit, or the environment itself.

[9:16] If you want to try it, take one

[9:18] task that is significantly more difficult than the ones you

[9:20] usually give Claude, and

[9:21] make sure you have a way to

[9:23] spot the error in time.

[9:24] Start working in Claude, see

[9:25] where sessions are getting stuck and where you're still

[9:27] interfering—that's what you should assign to

[9:29] Claude next.

[9:30] If you enjoyed this video or

[9:32] learned something new, please

[9:33] give it a like.  This helps me a lot.  And

[9:35] as always, I appreciate you

[9:36] watching the video to the end.  See

[9:38] you all in the next video.  Thank you

[9:39] all.
