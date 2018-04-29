var restify = require('restify');
var builder = require('botbuilder');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

// 科目表
const Detail_code_list = ["解剖", "胚胎", "組織", "微生物", "免疫", "寄生蟲", "其他", "生理", "生化", "藥理", "病理"];
var Questions;

//-------------------------------------------------------------------------------------------------------------

// Get user id
var bot = new builder.UniversalBot(connector, [
	function (session) {
        session.send(`哈囉~${session.message.user.name}你好\~\~`);
		session.send("我是一個練習醫師一階國考的聊天機器人，可以讓你練習歷屆的國考題。"); 
        session.replaceDialog('filter');
    }
]);

// Filter
bot.dialog('filter', [
    function (session) {
		var sample = ['我不知道要怎麼選欸'];
		var message = new builder.Message(session).text("那麼你想要練習什麼樣子的題目呢？").suggestedActions(
			builder.SuggestedActions.create(
				session, sample.map(choice => new builder.CardAction.imBack(session, choice, choice))
			)
		);
        builder.Prompts.text(session, message);
    },
	function (session, results){
		if (results.response == "我不知道要怎麼選欸") {
			session.send("你可以輸入一些條件來挑選想要練習的題目。目前可以輸入的條件有民國幾年、第幾次、科目。");
			session.send("舉例來說，你可以輸入「104年 第一次 解剖」，這樣我就會從104年第一次醫師國考的解剖學隨機挑題目出來給你練習。");
			session.send("你也可以輸入「解剖 生化」，這樣我就會從歷年所有國考的解剖學和組織學中隨機挑題目出來。");
			session.send("記得條件和條件之間要空格喔！就是這樣，試試看吧！");
			session.replaceDialog("filter");
		} else {
			filter_list = results.response.split(" ");
			session.privateConversationData.Filter_q_year = ["90到106"];
			session.privateConversationData.Filter_q_times = ["一、二"];
			session.privateConversationData.Filter_detail_code = ["全部科目"];
			session.privateConversationData.Filter_unknown = [];
			for (var i = 0; i < filter_list.length; i++) {
				if (Detail_code_list.indexOf(filter_list[i]) >= 0) {
					session.privateConversationData.Filter_detail_code.push(filter_list[i]);
					session.privateConversationData.Filter_detail_code = session.privateConversationData.Filter_detail_code.filter(function(e) { return e !== "全部科目" });
				}
				else if (filter_list[i].slice(-1) == "年"){
					session.privateConversationData.Filter_q_year.push(parseInt(filter_list[i].slice(0, -1)));
					session.privateConversationData.Filter_q_year = session.privateConversationData.Filter_q_year.filter(function(e) { return e !== "90到106" });
				}
				else if (filter_list[i].slice(0,1) == "第" && filter_list[i].slice(-1) == "次"){
					session.privateConversationData.Filter_q_times.push(filter_list[i].slice(1, -1));
					session.privateConversationData.Filter_q_times = session.privateConversationData.Filter_q_times.filter(function(e) { return e !== "一、二" });
				}
				else {
					session.privateConversationData.Filter_unknown.push(filter_list[i]);
				}
			}
		}
		session.replaceDialog('get_set');
	}
]);

// Get set
bot.dialog('get_set', [
    function (session) {
		if (session.privateConversationData.Filter_unknown.length != 0){
			session.send("抱歉，我不懂「"+session.privateConversationData.Filter_unknown.toString()+"」是什麼意思欸><");
		}
		var sample = ["OK","重選好了"];
		var message = new builder.Message(session).text("那麼我會從「"+session.privateConversationData.Filter_q_year.toString()+"年」的「第"+session.privateConversationData.Filter_q_times.toString()+"次」醫師一階國考選出「"+session.privateConversationData.Filter_detail_code.toString()+"」的題目給你練習囉~~").suggestedActions(
			builder.SuggestedActions.create(
				session, sample.map(choice => new builder.CardAction.imBack(session, choice, choice))
			)
		);
		builder.Prompts.text(session, message);
    },
    function (session, results) {
		if (results.response == "OK") {
			var url_ = "http://beta.cougarbot.cc/api/questions/raw_sql_query/?";
			
			session.privateConversationData.Filter_detail_code = session.privateConversationData.Filter_detail_code.filter(function(e) { return e !== "全部科目" });
			for (var i = 0; i < session.privateConversationData.Filter_detail_code.length; i++) {
				url_ = url_ + "detail_code=" + session.privateConversationData.Filter_detail_code[i] + "&";
			}
			
			session.privateConversationData.Filter_q_year = session.privateConversationData.Filter_q_year.filter(function(e) { return e !== "90到106" });
			for (var i = 0; i < session.privateConversationData.Filter_q_year.length; i++) {
				url_ = url_ + "q_year=" + session.privateConversationData.Filter_q_year[i].toString() + "&";
			}
			
			for (var i = 0; i < session.privateConversationData.Filter_q_times.length; i++) {
				if (session.privateConversationData.Filter_q_times[i] === "一"){
					url_ = url_ + "q_times=1&";
				}
				if (session.privateConversationData.Filter_q_times[i] === "二"){
					url_ = url_ + "q_times=2&";
				}
			}
			
			var utf8 = require('utf8');
			url_ = utf8.encode(url_);
			
			var request = require('request');
			var EventEmitter = require('events').EventEmitter;
			var body = new EventEmitter();
			
			request(url_.toString(), function(error, res, data) {
				body.data = data;
				body.emit('update');
			});
			body.on('update', function (){
				Questions = JSON.parse(body.data);
				session.replaceDialog("number");
			})

		} else if (results.response == "重選好了") {
			session.send("想要重選嗎？好的~")
			session.replaceDialog("filter");
		} else {
			session.send("嗯嗯我看不懂你說什麼？我們重選一次好了~")
			session.replaceDialog("filter");
		}
    },
]);

// Get number
bot.dialog('number',[
    (session)=>{
		builder.Prompts.number(session, "那你一次要答幾題呢？（請自己輸入數字喔）",{retryPrompt:'請輸入數字喔~'});
	},(session, results)=>{
		session.privateConversationData.num = results.response;
        if(session.privateConversationData.num>10){
			session.send("請先輸入1~10的數字喔，不然我怕有人輸入10000然後寫到天荒地老XD");
			session.replaceDialog('/number');
		}
		else if(session.privateConversationData.num<1){
			session.send("恩...應該至少要做一題吧XD");
			session.replaceDialog('/number');
		}
		else{
			session.privateConversationData.count = 0;       
			session.privateConversationData.num = results.response;
			session.privateConversationData.correct = 0;
			session.beginDialog('/qa');
		}
    }])
	
// QA
bot.dialog('/qa',[
    (session,next)=>{
		session.send("開始囉");
        session.beginDialog('/ask');
    },(session)=>{
		session.send("%d題做完囉，你一共答對了%d題，答對率是%d%%",session.privateConversationData.num, session.privateConversationData.correct, (session.privateConversationData.correct*100/session.privateConversationData.num));
		session.replaceDialog('filter');
	}
])

bot.dialog('/ask',[(session)=>{
        const baseLength = Questions.length;
        session.dialogData.randIdx = Math.floor(Math.random()*baseLength);
        session.privateConversationData.count++;
        session.dialogData.q = (Questions[session.dialogData.randIdx])['question']+'\n\n(A)'+(Questions[session.dialogData.randIdx])['choice_1']+'\n\n(B)'+(Questions[session.dialogData.randIdx])['choice_2']+'\n\n(C)'+(Questions[session.dialogData.randIdx])['choice_3']+'\n\n(D)'+(Questions[session.dialogData.randIdx])['choice_4'];
        session.dialogData.a = (Questions[session.dialogData.randIdx])['answer'];
        builder.Prompts.choice(session,session.dialogData.q,"A|B|C|D",{listStyle: builder.ListStyle["button"],retryPrompt:'請選擇ABCD喔'});
        
    },(session,results)=>{
        if(session.dialogData.a!=results.response.entity){
			if(session.dialogData.a.includes(results.response.entity)){
				session.send("答對囉，不過這題送分，正確的答案有%s。",session.dialogData.a);
				session.privateConversationData.correct++;
			}
            else{session.send("答錯囉，正確的答案是%s。",session.dialogData.a);}
        }else{
            session.send("答對了！");
			session.privateConversationData.correct++;
        }
        if(session.privateConversationData.count<session.privateConversationData.num){
            session.replaceDialog('/ask')
        }else{
            session.endDialog();
        }
    }])