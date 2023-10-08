/* JQuiz - a Javascript quiz library
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston,
 * MA 02110-1301, USA.
 *
 */

// Initialise global variables
var quiz_data = {};
var quiz_results = {};
var audio_correct;
var audio_incorrect;
var audio_music;

// Get things going
function jquiz_run() {
    jquiz_get_data();
    jquiz_audio_load();
    jquiz_load_quiz(function () {
        jquiz_shuffle_quiz();
        jquiz_start_button();
        document.exitFullscreen(); // Just in case it's still fullscreen
    });
}

function jquiz_quit() {
    jquiz_audio_stop();
    jquiz_run();
}

function jquiz_start_button() {
    console.log("JQuiz: Creating a start button for quiz");
    title = quiz_data['title'];
        html = `<h1 class="jquiz-contrast-with-bg jquiz-title">${title}</h1>
    <input type="button" value="Start the quiz" onclick="jquiz_start();" />
    <div id="jquiz-credits">
<p><a href="credits.html">JQuiz Credits</a></p>
</div>`;
    jquiz_write_interactive_html(html);
}

function jquiz_print() {
    jquiz_get_data();
    jquiz_load_quiz(function () {
        jquiz_shuffle_quiz();

        console.log("JQuiz: Writing out the questions");
        title = quiz_data['title'];
        html = `<h1 class="title">${title}</h1>`;
        jquiz_write_print_html(html);
        quiz_data['quiz'].forEach((question, index) => {
            if (index < quiz_data['max_questions']) {
                console.log(`JQuiz: Writing out question ${index}`);
                html = '<div class="jquiz-question">';
                html += jquiz_question_html(question);
                html += '</div>';
                html += '<div class="jquiz-answers">';
                html += jquiz_answer_html(question, true);
                html += '</div>';
                jquiz_write_print_html(html);
            }
            });
    });
}

function jquiz_load_quiz(callback) {
    // Get the file
    quiz_data['loaded'] = false;
    console.log("JQuiz: Loading " + quiz_data['src']);
    rq = new XMLHttpRequest();
    rq.onload = function() {
        console.log("JQuiz: Parsing file for quiz at " + quiz_data['src']);
        try {
            quiz_data['quiz'] = jquiz_parse_file(this.responseText);
        } catch (e) {
            alert(e);
            console.log("JQuiz: Parse failed with exception " + e);
            return
        }
        quiz_data['loaded'] = true;
        console.log("JQuiz: quiz at " + quiz_data['src'] + " parsed.");
        callback();
    }
    url_no_cache = quiz_data['src'] + "?v=" + Date.now();
    rq.open('GET', url_no_cache, true);
    rq.send();
}

// Populate quiz_data from GET parameters
function jquiz_get_data() {
    params = new URLSearchParams(window.location.search);
    quiz_data['src'] = params.get("src");
    quiz_data['title'] = params.get("title");
    quiz_data['max_questions'] = params.get("max_q");
}

function jquiz_audio_load() {
    // Sounds to play
    audio_correct = new Audio('media/applause_normal.mp3');
    audio_incorrect = new Audio('media/336998__timkahn__awww-01.mp3');
    audio_music = new Audio('media/sport-news-intro-01-by-taigasoundprod-from-filmmusic-io.mp3');
    audio_thinking = new Audio('media/thinking-time-148496.mp3');
}

function jquiz_audio_play_music() {
    audio_music.volume = 0.05;
    audio_music.play();
}

function jquiz_audio_music_ended(callback) {
    audio_music.onended = function() {
        callback();
        audio_music.onended = null;
    }
}

function jquiz_audio_play_thinking() {
    audio_thinking.volume = 0.05;
    audio_thinking.play();
}

function jquiz_audio_play_correct() {
    audio_correct.volume = 0.05;
    audio_correct.play();
}

function jquiz_audio_play_incorrect() {
    audio_incorrect.volume = 0.05;
    audio_incorrect.play();
}

function jquiz_audio_stop() {
    audio_correct.pause();
    audio_correct.currentTime = 0;
    audio_incorrect.pause();
    audio_incorrect.currentTime = 0;
    audio_music.pause();
    audio_music.currentTime = 0;
    audio_thinking.pause();
    audio_thinking.currentTime = 0;
}

function jquiz_write_interactive_html(html) {
    jquiz_div = document.getElementById('jquiz');
    jquiz_div.innerHTML = html;
}

function jquiz_write_print_html(html) {
    div = document.getElementById('jquiz');
    div.innerHTML += html;
}

function jquiz_start() {
    jquiz_audio_stop();
    // Did the quiz load?
    if (quiz_data['loaded'] == false) {
        alert("Quiz failed to load. Check the console log");
        return
    }
    // Splash Screen
    title = quiz_data['title'];
    html = `<div class="jquiz-splash">
            <p>${title}</p>
        </div>`
    jquiz_write_interactive_html(html);
    jquiz_audio_music_ended(jquiz_next_question);
    jquiz_audio_play_music();

    // Get ready to go
    console.log("JQuiz: Starting the quiz");
    quiz_results = {
        'q_index': 0,
        'completed': false,
        'score': 0,
        'num_questions': num_questions};
    div = document.getElementById('jquiz');
    div.requestFullscreen();
}

function jquiz_next_question() {
    console.log("JQuiz: Presenting next question for quiz");
    // Check if we're continuing an existing quiz
    if (quiz_results['completed']) {
        console.log("JQuiz: Quiz was completed. Displaying the final score");
        jquiz_show_scoreboard();
        return;
    } else {
        console.log("JQuiz: Quiz is incomplete. Continuing.");
    }
    // OK we're good to go.
    q_index = quiz_results['q_index'];
    q_number = q_index + 1;
    score = quiz_results['score'];
    num_questions = quiz_results['num_questions'];
    // TODO: Might need to check that the quiz has loaded first, and do
    // nothing otherwise, waiting for the user to click again.
    question = quiz_data['quiz'][q_index];

    question_html = jquiz_question_html(question);
    answer_html = jquiz_answer_html(question);

    // Increment the question number and check if the quiz will be completed with this question
    quiz_results['q_index']++;
    if (quiz_results['q_index'] >= quiz_results['num_questions']) {
        quiz_results['completed'] = true;
        console.log("JQuiz: This is the last question. Quiz is complete.");
        next_button_text = "Finish quiz";
    } else {
        next_button_text = "Next question";
    }
    html = `
        <div class="jquiz-quiz">
        <div class="jquiz-question jquiz-contrast-with-bg">
            ${question_html}
        </div>
        <div class="jquiz-answers jquiz-${question.answers.length}-answers">
            ${answer_html}
        </div>
        <div class="jquiz-bottombar jquiz-contrast-with-bg">
            <input type="image" class="jquiz-quit" value="quit" onclick="jquiz_quit();" />
            <p class="jquiz-qnum">Question ${q_number} of ${num_questions}</p>
            <p class="jquiz-score">Score: ${score}</p>
            <input type="button" value="Lock it in" class="jquiz-lock" onclick="jquiz_lock_it_in();" />
            <input type="button" value="${next_button_text}" class="jquiz-next" disabled onclick="jquiz_next_question();" />
        </div>
        </div>`;
    // Put the HTML into the quiz div
    jquiz_write_interactive_html(html);

    // Enable the lock it in button
    selector = ".jquiz-lock";
    lock_button = document.querySelector(selector);
    lock_button.disabled = false;

    // Play the thinking music
    jquiz_audio_play_thinking();
}

function jquiz_question_html(question) {
    // Build up some HTML for the question
    question_html = jquiz_text_image_html(question, quiz_data['src']);
    return question_html;
}

function jquiz_answer_html(question, add_div=false) {
    // Build up some HTML for the answers
    answer_code = [];
    // How many correct answers are there?
    input_type = 'none';
    question.answers.forEach((answer, index) => {
        if (answer.correct == 'true') {
            if (input_type == 'none') {
                input_type = 'radio';
                console.log("radio");
            } else {
                if (input_type == 'radio') {
                    input_type = 'checkbox';
                    console.log("checkbox");
                }
            }
        }
    });
    question.answers.forEach((answer, index) => {
        // Not guaranteed unique but hopefully good enough
        answer_id = (Math.random() * 10**20).toString();
        answer_snippet = jquiz_text_image_html(answer, quiz_data['src']);
        if (add_div == true)
            answer_code.push('<div class="jquiz-answer">');
        answer_code.push(`<input type="${input_type}" id="${answer_id}" name="jquiz-${input_type}" correct="${answer.correct}" index="${index}" />
        <label for="${answer_id}">${answer_snippet}</label>`);
        if (add_div == true)
            answer_code.push('</div>');
    });
    answer_html = answer_code.join("\n");
    return answer_html;
}

function jquiz_text_image_html(thing) {
    if (thing.text === undefined) {
        text = '';
    } else {
        text = thing.text.trim();
    }
    if (thing.image === undefined) {
        image = '';
    } else {
        image = thing.image.trim();
        // Generate a usable path to the image.
        // If it is an absolute path, we're OK.
        if (! image.startsWith('/')) {
            // If it's a relative path, prepend the location of the
            // quiz URL with the last element (the quiz file) removed.
            path = quiz_data['src'].split('/').slice(0,-1);
            path.push(image);
            image = path.join('/');
            console.log(image);
        }
    }
    html = '';
    if (text.length > 0) {
        html += `<div>${text}</div>`;
    }
    if (image.length > 0) {
        html += `<img src=${image} />`;
    }
    return html;
}

function jquiz_show_scoreboard() {
    // Play some up-beat music
    jquiz_audio_stop();
    jquiz_audio_play_music();
    // Display the score
    score = quiz_results['score'];
    num_questions = quiz_results['num_questions'];
    html = `
        <div class="jquiz-quiz">
        <div class="jquiz-scoreboard">
            <p>You scored<br><span class="score">${score}</span><br> out of ${num_questions}</p>
        </div>
        <div class="jquiz-bottombar">
            <input type="button" value="close" class="jquiz-close" onclick="jquiz_start_button();" />
        </div>
        </div>`;
    // Put the HTML into the quiz div
    jquiz_write_interactive_html(html);
}

function jquiz_key_in_dict(key, dict) {
    // The following code is required because checking if key is in
    // dict, for quizzes, always gives false, even when it should be true
    id_in_results = false;
    ids = Object.keys(dict);
    ids.forEach(k => {
        if (key == k)
            id_in_results = true;
    });
    return id_in_results
}

function jquiz_shuffle_quiz() {
    console.log("JQuiz: Shuffling quiz");
    // Shuffle the questions
    jquiz_shuffle(quiz_data['quiz']);
    // Also shuffle the answers
    quiz_data['quiz'].forEach(question => jquiz_shuffle(question.answers));
    // How many questions are we going to show?
    num_questions = quiz_data['quiz'].length;
    if (quiz_data['max_questions'] === null) {
        num_questions = quiz_data['quiz'].length;
    } else {
        num_questions = Math.min(num_questions, quiz_data['max_questions']);
    }
}

function jquiz_lock_it_in() {
    // Check the answer, update the score etc.
    user_correct = true;
    selector = ".jquiz-answers input";
    answers = document.querySelectorAll(selector);
    answers.forEach(answer => {
        answer.disabled = true;
        is_correct = (answer.getAttribute("correct") == "true");
        if (is_correct)
            answer.classList.add("correct");
        else
            answer.classList.add("incorrect");
        right_answer = (is_correct == answer.checked);
        console.log(right_answer);
        user_correct = user_correct && right_answer;
    });
    jquiz_audio_stop();
    if (user_correct) {
        quiz_results['score']++;
        jquiz_audio_play_correct();
    } else {
        jquiz_audio_play_incorrect();

    }
    console.log("User is", user_correct);
    // Enable the "next question" button.
    selector = ".jquiz-next";
    next_button = document.querySelector(selector);
    next_button.disabled = false;
    selector = ".jquiz-lock";
    lock_button = document.querySelector(selector);
    lock_button.disabled = true;
    selector = ".jquiz-score";
    score_text = document.querySelector(selector);
    score_text.innerHTML = "Score: " + quiz_results['score'];
}


function jquiz_is_new_question(line) {
    return line.startsWith('%') && ! line.startsWith('%%');
}

function jquiz_parse_file(text) {
    quiz_text = text.split("\n"); // Convert to an array of lines
    //// Basic checks on the file content
    // Check that the first line contains a jquiz signature
    jquiz_sig = /%\s*jquiz$/;
    if (! jquiz_sig.test(quiz_text[0])) {
        throw new Error("jquiz: '% jquiz' signature not found on line 1 of quiz file");
    }
    // Get rest of the file as an array of lines
    quiz_text = quiz_text.slice(1);
    if (quiz_text.length < 1)
        // There's no actual quiz content
        throw new Error("jquiz: no quiz content");
    // Get rid of any leading blank lines
    while (quiz_text[0].trim().length == 0)
        quiz_text = quiz_text.slice(1);
        if (quiz_text.length < 1)
            // There's no actual quiz content
            throw new Error("jquiz: no quiz content");
    // Process the questions
    if (! jquiz_is_new_question(quiz_text[0])) {
        // If it's not a new question
        throw new Error("jquiz: '% line 2 doesn't start a question");
    }
    raw_questions = [];
        // Contains arrays of [q, def] where q is the question definition
        // and def is an array of all the lines it contains
    quiz_text.forEach(line => {
        if (jquiz_is_new_question(line))
            raw_questions.push([line, []]);
        else {
            // Apply %% unescaping
            if (line.startsWith('%%'))
                // Handle % escaping
                line = line.slice(1);
            raw_questions[raw_questions.length - 1][1].push(line);
        }
    });
    quiz = [];
    raw_questions.forEach(rq => {
        [q_def, q_content] = rq;
        // Get the question type
        def_regex = /%\s*([a-zA-Z#]+)\s*/;
        [line, q_type] = q_def.match(def_regex);
        question = {};
        // Go through each line of content and populate the question
        answer_regex = /@\s*([a-zA-Z]+)\s*(.*)\s*/
        key_val_regex = /\s*([a-zA-Z]+)\s*:\s*(.*)\s*/
        info = {}; // A temp place to hold the key:value pairs we find
        answers = []; // An array to hold all the answers
        q_content.forEach(line => {
            if (answer_regex.test(line)) {
                // We have a new answer, push the previous content
                // to the right places
                if (Object.keys(question).length == 0) {
                    // First answer, fill question content
                    question['type'] = q_type;
                    for (key of Object.keys(info)) {
                        question[key] = info[key];
                    }
                    info = {} // Reinitialise info for the next set of key:values
                } else {
                    // Previous content was an answer.
                    answers.push(info);
                    info = {} // Reinitialise info for the next set of key:values
                }
            } else {
                // It's just a line, parse into key:value pairs
                if (line.startsWith('@@'))
                    // Handle @ escaping
                    line = line.slice(1);
                try {
                    [line, key, value] = line.match(key_val_regex);
                    info[key] = value;
                }
                catch (err) {} // Ignore lines that aren't key:value
            }
        });
        answers.push(info); // Any remaining content is the final answer
        question['answers'] = answers;
        quiz.push(question);
    });
    return quiz;
}

function jquiz_shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
