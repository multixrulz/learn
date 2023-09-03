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

var jquiz_firstload;

if (jquiz_firstload === undefined) {
    jquiz_firstload = false;
    // Add the stylesheet for jquiz
    var link = document.createElement('link');
    link.setAttribute('href', "/jquiz/jquiz.css");
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('type', 'text/css');
    document.head.appendChild(link);

    // A dictionary to hold all the quiz_id's on the page and the URLs
    // they correspond to.
    // quiz_id is a unique ID for when multiple quizes are on one page
    // It gets "runtime-coded" into the HTML elements so that they can always
    // look up their own quiz_id when events happen
    var quiz_ids = {};
    var quiz_results = {};
    // A dictionary to hold the quiz data for each URL
    var quizzes = {};

    // Sounds to play
    var audio_correct = new Audio('/jquiz/media/applause_normal.mp3');
    var audio_incorrect = new Audio('/jquiz/media/336998__timkahn__awww-01.mp3');
    var audio_music = new Audio('/jquiz/media/sport-news-intro-01-by-taigasoundprod-from-filmmusic-io.mp3');

    function stop_all_audio() {
        audio_correct.pause();
        audio_correct.currentTime = 0;
        audio_incorrect.pause();
        audio_incorrect.currentTime = 0;
        audio_music.pause();
        audio_music.currentTime = 0;
    }

    function jquiz_insert(url, title, max_questions) {
    /* This function inserts a quiz from the given url onto the page -
     * if it's not already loaded. It also creates a unique quiz_id to
     * track the quiz on the page.
     *
     * It then creates a "start" button to start the quiz.
     *
     * title: the title of the quiz
     * max_questions - optional: the number of questions to present.
     * * If it's less than the number of questions in the quiz file,
     *   randomly choose this number of questions to present.
     * * If it's zero, present all questions.
     */
        // Get the file
        console.log("JQuiz: Loading " + url);
        if (! (url in quizzes)) {
            // Only load the quiz if it's not already loaded
            quizzes[url] = {'loaded': false}; // A placeholder to prevent dual loading while the quiz is fetched
            rq = new XMLHttpRequest();
            rq.onload = function() {
                console.log("JQuiz: Parsing file for quiz at " + url);
                try {
                    quizzes[url]['quiz'] = jquiz_parse_file(this.responseText);
                } catch (e) {
                    alert(e);
                    console.log("JQuiz: Parse failed with exception " + e);
                    return
                }
                quizzes[url]['loaded'] = true;
                console.log("JQuiz: quiz at " + url + " parsed.");
            }
            url_no_cache = url + "?v=" + Date.now();
            rq.open('GET', url_no_cache, true);
            rq.send();
        } else {
            console.log("JQuiz: Quiz was already loaded (or loading)");
        }
        // Create a unique quiz_id
        quiz_id = jquiz_unique_id(url);
        quiz_ids[quiz_id].title = title;
        if (max_questions === undefined) {
            quiz_ids[quiz_id].max_questions = 0;
        } else {
            quiz_ids[quiz_id].max_questions = max_questions;
        }
        // Create a HTML container for the unique quiz
        console.log("JQuiz: Creating a div container for the quiz", quiz_id);
        document.write(`
        <div class="jquiz-container" id="jquiz-${quiz_id}">
        </div>`);
        // Display a start button
        jquiz_display_start(quiz_id);
    }

    function jquiz_unique_id(url) {
        have_unique_id = false;
        while (! have_unique_id) {
            id = (Math.random() * 10**20).toString();
            ids = Object.keys(quiz_ids);
            if (! (id in ids))
                have_unique_id = true;
        }
        quiz_ids[id] = {}
        quiz_ids[id].url = url;
        return id;
    }

    function write_html_to_quiz(quiz_id, html) {
        div = document.getElementById(`jquiz-${quiz_id}`);
        div.innerHTML = html;
    }

    function jquiz_display_start(quiz_id) {
        console.log("JQuiz: Creating a start button for quiz", quiz_id);
        title = quiz_ids[quiz_id].title;
        html = `<p>${title}</p>
    <input type="button" value="Start the quiz" onclick="jquiz_start(${quiz_id});" />`;
        write_html_to_quiz(quiz_id, html);
        div = document.getElementById(`jquiz-${quiz_id}`);
        document.exitFullscreen();
    }

    function jquiz_start(quiz_id) {
        stop_all_audio();
        // Did the quiz load?
        url = quiz_ids[quiz_id].url;
        if (quizzes[url].loaded == false) {
            alert("Quiz failed to load. Check the console log");
            return
        }
        audio_music.play();
        quiz_id = quiz_id.toString();
        console.log("JQuiz: Starting the quiz with id", quiz_id);
        div = document.getElementById(`jquiz-${quiz_id}`);
        jquiz_init_quiz(quiz_id);
        div.requestFullscreen();
        jquiz_next_question(quiz_id);
    }

    function jquiz_next_question(quiz_id) {
        quiz_id = quiz_id.toString();
        console.log("JQuiz: Presenting next question for quiz with id", quiz_id);
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
        url = quiz_ids[quiz_id].url;
        question = quiz_ids[quiz_id].questions[q_index];
        // Build up some HTML for the question
        question_html = jquiz_text_image_html(question, url)
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
            answer_snippet = jquiz_text_image_html(answer, url);
            answer_code.push(`<input type="${input_type}" id="${answer_id}" name="jquiz-${quiz_id}-${input_type}" correct="${answer.correct}" index="${index}" />
            <label for="${answer_id}">${answer_snippet}</label>`);
        });
        answer_html = answer_code.join("\n");

        // Increment the question number and check if the quiz will be completed with this question
        quiz_results[quiz_id]['q_index']++;
        if (quiz_results[quiz_id]['q_index'] >=
            quiz_results[quiz_id]['num_questions']) {
                quiz_results[quiz_id]['completed'] = true;
                console.log("JQuiz: This is the last question. Quiz is complete.");
            next_button_text = "Finish quiz";
        } else {
            next_button_text = "Next question";
        }
        html = `
            <div class="jquiz-quiz">
            <div class="jquiz-question">
                ${question_html}
            </div>
            <div class="jquiz-answers jquiz-${question.answers.length}-answers">
                ${answer_html}
            </div>
            <div class="jquiz-bottombar">
                <p class="jquiz-qnum">Question ${q_number} of ${num_questions}</p>
                <p class="jquiz-score">Score: ${score}</p>
                <input type="button" value="Lock it in" class="jquiz-lock" onclick="jquiz_lock_it_in(${quiz_id});" />
                <input type="button" value="${next_button_text}" class="jquiz-next" disabled onclick="jquiz_next_question(${quiz_id});" />
            </div>
            </div>`;
        // Put the HTML into the quiz div
        write_html_to_quiz(quiz_id, html);

        // Enable the lock it in button
        selector = "#jquiz-" + quiz_id + " .jquiz-lock";
        lock_button = document.querySelector(selector);
        lock_button.disabled = false;
    }

    function jquiz_text_image_html(thing, quizurl) {
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
                path = quizurl.split('/').slice(0,-1);
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

    function jquiz_show_scoreboard(quiz_id) {
        // Play some up-beat music
        stop_all_audio();
        audio_music.play();
        // Display the score
        score = quiz_results[quiz_id]['score'];
        num_questions = quiz_results[quiz_id]['num_questions'];
        html = `
            <div class="jquiz-quiz">
            <div class="jquiz-scoreboard">
                <p>You scored<br><span class="score">${score}</span><br> out of ${num_questions}</p>
            </div>
            <div class="jquiz-bottombar">
                <input type="button" value="close" class="jquiz-close" onclick="jquiz_display_start(${quiz_id});" />
            </div>
            </div>`;
        // Put the HTML into the quiz div
        write_html_to_quiz(quiz_id, html);
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
        url = quiz_ids[quiz_id].url;
        //// Shuffle the quiz questions each time
        // Deep copy the quiz array
        quiz_ids[quiz_id].questions = structuredClone(quizzes[url].quiz.questions);
        // Shuffle the questions
        shuffle(quiz_ids[quiz_id].questions);
        // Also shuffle the answers
        quiz_ids[quiz_id].questions.forEach(question => shuffle(question.answers));
        // How many questions are we going to show?
        num_questions = quizzes[url]['quiz']['questions'].length;
        if (quiz_ids[quiz_id].max_questions > 0) { // 0 means show the whole quiz
            num_questions = Math.min(num_questions, quiz_ids[quiz_id].max_questions);
        }
        quiz_results[quiz_id] = {
            'q_index': 0,
            'completed': false,
            'score': 0,
            'num_questions': num_questions};
    }

    function jquiz_lock_it_in(quiz_id) {
        // Check the answer, update the score etc.
        user_correct = true;
        selector = "#jquiz-" + quiz_id + " .jquiz-answers input";
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
        stop_all_audio();
        if (user_correct) {
            quiz_results[quiz_id]['score']++;
            audio_correct.play();
        } else {
            audio_incorrect.play();
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

    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}
