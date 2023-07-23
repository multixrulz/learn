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

// Add the stylesheet for jquiz
link = document.createElement('link');
link.setAttribute('href', "/jquiz/jquiz.css");
link.setAttribute('rel', 'stylesheet');
link.setAttribute('type', 'text/css');
document.head.appendChild(link);
console.log(link);

// A dictionary to hold all the quiz_id's on the page and the URLs
// they correspond to.
// quiz_id is a unique ID for when multiple quizes are on one page
// It gets "runtime-coded" into the HTML elements so that they can always
// look up their own quiz_id when events happen
quiz_ids = {};
// A dictionary to hold the quiz data for each URL
quizzes = {};

// Sounds to play
audio_applause = new Audio('/jquiz/media/applause_normal.mp3');

function jquiz_is_new_question(line) {
    return line.startsWith('%') && ! line.startsWith('%%');
}

function jquiz_parse_file(text) {
    quiz_text = text.split("\n"); // Convert to an array of lines
    //// Basic checks on the file content
    // Check that the first line contains a revelation signature
    jquiz_sig = /%\s*jquiz$/;
    if (! jquiz_sig.test(quiz_text[0])) {
        alert("jquiz: '% jquiz' signature not found on line 1 of quiz file");
        return
    }
    // Get rest of the file as an array of lines
    quiz_text = quiz_text.slice(1);
    if (quiz_text.length < 1)
        // There's no actual quiz content
        return
    if (! jquiz_is_new_question(quiz_text[0])) {
        // If it's not a new question
        alert("jquiz: '% line 2 doesn't start a question");
        return
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
    quiz = {'questions': []};
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
        quiz['questions'].push(question);
    });
    return quiz;
}

/*
function jquiz_quiz_url_loaded() {
    // Create a quiz ID
    //quiz_id = jquiz_unique_id();
    //quiz_ids.push(quiz_id);
    console.log("JQuiz: Parsing file for quiz " + quiz_id);
    quiz = jquiz_parse_file(this.responseText);
    console.log(quiz);
    console.log("JQuiz: quiz " + quiz_id + " parsed.");
}
*/

function jquiz_load(url) {
    // Get the file
    console.log("JQuiz: Loading " + url);
    if (! (url in quizzes)) {
        // Only load the quiz if it's not already loaded
        quizzes[url] = {'loaded': false}; // A placeholder to prevent dual loading while the quiz is fetched
        rq = new XMLHttpRequest();
        rq.onload = function() {
            console.log("JQuiz: Parsing file for quiz at " + url);
            quizzes[url]['quiz'] = jquiz_parse_file(this.responseText);
            quizzes[url]['loaded'] = true;
            console.log("JQuiz: quiz at " + url + " parsed.");
        }
        url_no_cache = url + "?v=" + Date.now();
        rq.open('GET', url_no_cache, true);
        rq.send();
    } else {
        console.log("JQuiz: Quiz was already loaded (or loading)");
    }
    // Display a start button
    jquiz_create_html(url);
}

function jquiz_unique_id(url) {
    have_unique_id = false;
    while (! have_unique_id) {
        id = (Math.random() * 10**20).toString();
        ids = Object.keys(quiz_ids);
        if (! (id in ids))
            have_unique_id = true;
    }
    quiz_ids[id] = url;
    return id;
}

quiz_results = {};

function jquiz_create_html(url) {
    quiz_id = jquiz_unique_id(url);
    console.log("JQuiz: Creating HTML elements for quiz", quiz_id);
    document.write(`
    <div class="jquiz-container" id="jquiz-${quiz_id}">
        <input type="button" value="Start the quiz" onclick="jquiz_next_question(${quiz_id});" />
    </div>`);
}

function jquiz_next_question(quiz_id) {
    quiz_id = quiz_id.toString();
    console.log("JQuiz: Presenting next question for quiz with id", quiz_id);
    url = quiz_ids[quiz_id];
    id_in_results = jquiz_key_in_dict(quiz_id, quiz_results);
    // Check if we're continuing an existing quiz
    if (id_in_results) {
        console.log("JQuiz: Quiz has been started.");
        if (quiz_results[quiz_id]['completed']) {
            console.log("JQuiz: Quiz was completed. Displaying the final score");
            jquiz_show_scoreboard(quiz_id);
            return;
        } else {
            console.log("JQuiz: Quiz is incomplete. Continuing.");
        }
    } else {
        // Initialise a new quiz
        jquiz_init_quiz(quiz_id);
    }
    // OK we're good to go.
    q_index = quiz_results[quiz_id]['q_index'];
    q_number = q_index + 1;
    score = quiz_results[quiz_id]['score'];
    num_questions = quiz_results[quiz_id]['num_questions'];
    // TODO: Might need to check that the quiz has loaded first, and do
    // nothing otherwise, waiting for the user to click again.
    question = quizzes[url]['quiz']['questions'][q_index];
    // Build up some HTML for the question
    question_html = `
            <h1>${question.text}<h1>
            <img src=${question.image} />`;
    // Build up some HTML for the answers
    answer_code = [];
    question.answers.forEach((answer, index) => {
        // Not guaranteed unique but hopefully good enough
        answer_id = (Math.random() * 10**20).toString();
        answer_code.push(`
            <input type="radio" id="${answer_id}" name="jquiz-${quiz_id}-radios" correct="${answer.correct}" index="${index}" />
            <label for="${answer_id}">${answer.text}</label>`);
        });
    answer_html = answer_code.join("\n");
    html = `
        <div class="jquiz-quiz">
        <div class="jquiz-question">
            ${question_html}
        </div>
        <div class="jquiz-answers">
            ${answer_html}
        </div>
        <div class="jquiz-bottombar">
            <p class="jquiz-qnum">Question ${q_number} of ${num_questions}</p>
            <p class="jquiz-score">Score: ${score}</p>
            <input type="button" value="Lock it in" class="jquiz-lock" onclick="jquiz_lock_it_in(${quiz_id});" />
            <input type="button" value="Next question" class="jquiz-next" disabled onclick="jquiz_next_question(${quiz_id});" />
        </div>
        </div>`;
    // Put the HTML into the quiz div
    div = document.getElementById(`jquiz-${quiz_id}`);
    div.innerHTML = html;

    // Increment the question number and check if the quiz has been completed
    quiz_results[quiz_id]['q_index']++;
    if (quiz_results[quiz_id]['q_index'] >=
        quiz_results[quiz_id]['num_questions']) {
            quiz_results[quiz_id]['completed'] = true;
            console.log("JQuiz: That was the last question. Quiz is complete.");
    }

    // Enable the lock it in button
    selector = "#jquiz-" + quiz_id + " .jquiz-lock";
    lock_button = document.querySelector(selector);
    lock_button.disabled = false;
}

function jquiz_show_scoreboard(quiz_id) {

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

function jquiz_init_quiz(quiz_id) {
    console.log("JQuiz: Starting quiz");
    quiz_results[quiz_id] = {
        'q_index': 0,
        'completed': false,
        'score': 0,
        'num_questions': quizzes[url]['quiz']['questions'].length};
}

function jquiz_lock_it_in(quiz_id) {
    // Check the answer, update the score etc.
    user_correct = true;
    selector = "#jquiz-" + quiz_id + " input[type=radio]";
    answers = document.querySelectorAll(selector);
    answers.forEach(answer => {
        answer.disabled = true;
        is_answer = (answer.getAttribute("correct") == "true");
        if (is_answer)
            answer.classList.add("correct");
        else
            answer.classList.add("incorrect");
        right_answer = (is_answer == answer.checked);
        user_correct = user_correct && right_answer;
    });
    if (user_correct) {
        quiz_results[quiz_id]['score']++;
        audio_applause.pause(); // In case it's still playing
        audio_applause.currentTime = 0;
        audio_applause.play();
    } else {

    }
    console.log("User is", user_correct);
    // Enable the "next question" button.
    selector = "#jquiz-" + quiz_id + " .jquiz-next";
    next_button = document.querySelector(selector);
    next_button.disabled = false;
    selector = "#jquiz-" + quiz_id + " .jquiz-lock";
    lock_button = document.querySelector(selector);
    lock_button.disabled = true;
    selector = "#jquiz-" + quiz_id + " .jquiz-score";
    score_text = document.querySelector(selector);
    score_text.innerHTML = "Score: " + quiz_results[quiz_id]['score'];
}
