var __gcrExtAnswers;

(function () {
    setTimeout(function () {
        //ToDo fix exception with getElement, create mask on http://support.standsystematic.ru/browse/CREATIOSUP-53

        //const addcomment = document.getElementById('addcomment');
        //if (addcomment != null) {
        //    const area = addcomment.getElementsByClassName('sd-comment-container')[0];

        //    area.addEventListener("change", function (e) {
        //        addAnswerButton();
        //    });
        //    area.addEventListener("click", function (e) {
        //        addAnswerButton();
        //    });
        //    area.addEventListener("submit", function (e) {
        //        addAnswerButton();
        //    });
        //}

        "use strict";

        // This following code is taken from
        // https://github.com/thieman/github-selfies/blob/master/chrome/selfie.js
        var allowedPaths = [
            // Jira
            /jira.*\.com\//,
            /jira./
        ];

        // Inject the code from fn into the page, in an IIFE.
        function inject(fn) {
            var script = document.createElement('script');
            var parent = document.documentElement;
            script.textContent = '(' + fn + ')();';
            parent.appendChild(script);
            parent.removeChild(script);
        }

        // Post a message whenever history.pushState is called. GitHub uses
        // pushState to implement page transitions without full page loads.
        // This needs to be injected because content scripts run in a sandbox.
        inject(function () {
            var pushState = history.pushState;
            history.pushState = function on_pushState() {
                window.postMessage('extension:pageUpdated', '*');
                return pushState.apply(this, arguments);
            };
            var replaceState = history.replaceState;
            history.replaceState = function on_replaceState() {
                window.postMessage('extension:pageUpdated', '*');
                return replaceState.apply(this, arguments);
            };
        });

        // Do something when the extension is loaded into the page,
        // and whenever we push/pop new pages.
        window.addEventListener("message", function (event) {
            if (event.data === 'extension:pageUpdated') {
                addAnswerButton();
            }
        });
        
        window.addEventListener("popstate", load);
        load();

        function load() {
            chrome.runtime.sendMessage({ action: 'load' }, function (response) {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', 'http://api.standsystematic.ru/GetDataFromComfluense', true);
                xhr.send(null);
                xhr.onload = function (e) {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200) {
                            __gcrExtAnswers = JSON.parse(xhr.responseText);
                            addAnswerButton();
                            addMutationObserver();
                        } else {
                            console.error(xhr.statusText);
                        }
                    }
                };
            });
        }

        function any(array, predicate) {
            for (var i = 0; i < array.length; i++) {
                if (predicate(array[i])) {
                    return true;
                }
            }
            return false;
        }

        function addMutationObserver() {
            // Mutation observer for editing description.
            var observer = new MutationObserver(function (mutations, observer) {
                var toolBar = document.querySelector("#description-val .aui-toolbar2-primary")
                if (toolBar) {
                    addAnswerButton();
                }

            });

            // Mutation observer for create and edit modals.
            var bodyObserver = new MutationObserver(function (mutations, bodyObserver) {
                var createIssueModal = document.getElementById("create-issue-dialog")
                var editCommentModal = document.getElementById("edit-comment");
                if (createIssueModal || editCommentModal) {
                    addAnswerButton()
                }
            });

            var descriptionEditor = document.getElementById("description-val")
            if (descriptionEditor) {
                observer.observe(descriptionEditor, { childList: true });
            }
            bodyObserver.observe(document.body, { childList: true });
        }

        function addAnswerButton() {
            //if (!any(allowedPaths, (path) => path.test(window.location.href))) {
            //  // NOPE.
            //  return;
            //}

            var existingButtons = document.querySelectorAll('.jira-canned-response-item');
            if (existingButtons.length > 0) {
                setTimeout(addAnswerButton, 1000);
                return;
            }           
            if (existingButtons && existingButtons.length !== 0) {
                for (var i = 0; i < existingButtons.length; i++) {
                    existingButtons[i].parentNode.removeChild(existingButtons[i]);
                }
            }

            var targets = document.querySelectorAll('.aui-toolbar2-primary');
            if (targets.length == 0) {
                setTimeout(addAnswerButton, 500);
                return;
            }

            for (var i = 0; i < targets.length; i++) {
                var target = createNodeWithClass('div', 'toolbar-group jira-canned-response-item');
                targets[i].insertBefore(target, targets[i].childNodes[0]);

                var item = createNodeWithClass('div', 'select-menu js-menu-container js-select-menu label-select-menu');
                target.appendChild(item);

                var button = createButton();
                item.appendChild(button);

                button.addEventListener("click", function (e) {
                    var bodyListener;
                    this.parentNode.classList.toggle("active");
                    var currentNode = this.parentNode;

                    var bodyEventListener = function (event) {
                        // if the click event is on the menu iteself
                        if (event.target.closest(".active") && event.target.closest(".active") == currentNode) {
                            return;
                        }
                        // Check if the menu is open otherwise.
                        else if (currentNode.classList.contains("active")) {
                            currentNode.classList.toggle("active");
                        }
                        else {
                            return;
                        }
                    }

                    bodyListener = this.getAttribute("bodyListener")
                    if (this.parentNode.classList.contains("active") && bodyListener == "false") {
                        // Sets event listener for closing the menu.
                        document.body.addEventListener("click", bodyEventListener, true);
                        this.setAttribute("bodyListener", true)
                    }

                    if (!this.parentNode.querySelector(".select-menu-modal-holder.js-menu-content")) {
                        var skipEditButton;

                        if (this.parentNode.closest('#create-issue-dialog') || this.parentNode.closest('#edit-comment')) {
                            // Skips edit button inside modals.
                            skipEditButton = true;
                        }
                        var dropdown = createDropdown(__gcrExtAnswers, skipEditButton);
                        this.parentNode.appendChild(dropdown);
                    }
                    e.stopImmediatePropagation();
                });
            }
            setTimeout(addAnswerButton, 1000);
            return;
        }


        function createNodeWithClass(nodeType, className) {
            var element = document.createElement(nodeType);
            element.className = className;
            return element;
        }

        function createButton() {
            var button = createNodeWithClass('button', 'toolbar-item tooltipped tooltipped-n js-menu-target menu-target');

            button.setAttribute('aria-label', 'Insert canned response');
            button.setAttribute('bodyListener', false);
            button.style.display = 'inline-block';
            button.type = 'button';

            var svg = createSVG(18, 16, 'octicon-mail-read', "M6 5H4v-1h2v1z m3 1H4v1h5v-1z m5-0.48v8.48c0 0.55-0.45 1-1 1H1c-0.55 0-1-0.45-1-1V5.52c0-0.33 0.16-0.63 0.42-0.81l1.58-1.13v-0.58c0-0.55 0.45-1 1-1h1.2L7 0l2.8 2h1.2c0.55 0 1 0.45 1 1v0.58l1.58 1.13c0.27 0.19 0.42 0.48 0.42 0.81zM3 7.5l4 2.5 4-2.5V3H3v4.5zM1 13.5l4.5-3L1 7.5v6z m11 0.5L7 11 2 14h10z m1-6.5L8.5 10.5l4.5 3V7.5z");
            button.appendChild(svg);
            var span = createNodeWithClass('span', 'dropdown-caret');
            button.appendChild(span);

            return button;
        }

        function createDropdown(answers, skipEditButton) {
            // This should use the fuzzy search instead (see labels)
            var outer = createNodeWithClass('div', 'select-menu-modal-holder js-menu-content js-navigation-container');
            var inner = createNodeWithClass('div', 'select-menu-modal');
            outer.appendChild(inner);

            // I hate the DOM.
            var header = createNodeWithClass('div', 'select-menu-header');
            var headerSpan = createNodeWithClass('span', 'select-menu-title');
            var spanText = document.createElement('text');
            spanText.innerHTML = 'Canned responses ';
            headerSpan.appendChild(spanText);

            if (!skipEditButton) {
                var editButton = createNodeWithClass('button', 'btn-link jira-canned-response-edit');
                editButton.type = 'button';
                editButton.innerHTML = '(edit or add new)';
                editButton.addEventListener('click', showEditView);
                headerSpan.appendChild(editButton);
            }

            header.appendChild(headerSpan);
            inner.appendChild(header);

            var searcher = createNodeWithClass('div', 'select-menu-header');
            var searcherSpan = createNodeWithClass('span', 'select-menu-title');
            var searchText = document.createElement('text');
            searchText.innerHTML = 'Поиск';
            searcherSpan.appendChild(searchText);

            if (!skipEditButton) {
                var serchInput = createNodeWithClass('input', 'search-link jira-canned-response-edit');
                serchInput.type = 'input';
                serchInput.addEventListener('input', searchEditView);
                searcherSpan.appendChild(serchInput);
            }

            searcher.appendChild(searcherSpan);
            inner.appendChild(searcher);

            var main = createNodeWithClass('div', 'js-select-menu-deferred-content');
            inner.appendChild(main);

            var itemList = createNodeWithClass('div', 'select-menu-list');

            main.appendChild(itemList);

            for (var i = 0; i < answers.length; i++) {
                var item = createDropdownItem(i + 1, answers[i].name);
                itemList.appendChild(item);
                item.answer = answers[i].description;
                item.addEventListener('click', insertAnswer);

                // Gigantic hack because the PR page is not setting up mouse events correctly.
                item.addEventListener('mouseenter', function () {
                    this.className += ' navigation-focus';
                });
                item.addEventListener('mouseleave', function () {
                    this.className = this.className.replace(/ navigation-focus/g, '');
                });
            }

            return outer;
        }

        function createDropdownItem(count, text) {
            var item = createNodeWithClass('div', 'select-menu-item js-navigation-item');
            item.textContent = count + "." + text;
            return item;
        }

        function createSVG(height, width, octiconName, octiconPath) {
            var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'octicon ' + octiconName);
            svg.style.height = height + 'px';
            svg.style.width = width + 'px';
            svg.setAttribute('viewBox', '0 0 ' + height + ' ' + width);

            var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttributeNS(null, 'd', octiconPath);
            svg.appendChild(path);

            return svg;
        }

        function insertAnswer(event) {
            var textarea = document.getElementById('comment');
            var item = event.target;
            textarea.value = item.answer;
        }
        function searchEditView() {
            var elements = document.getElementsByClassName('select-menu-item');
            var str = document.getElementsByClassName('search-link jira-canned-response-edit')[0].value.toLowerCase();
            for (var i = 0; i < elements.length; i++) {
                elements[i].hidden = !elements[i].textContent.toLowerCase().includes(str);
            }
            return;
        }

        function showEditView() {

            var dialog = createNodeWithClass('div', 'gcr-ext-editor-dialog');
            dialog.id = 'gcr-ext-editor';

            // lol. This is from options.html.
            // TODO: Replace this with ES6 civilized strings when you're less scared
            // about breaking everything.
            dialog.innerHTML = '<div class="gcr-ext-editor-close"></div><div class="gcr-ext-editor-dialog-inner"><div class="gcr-ext-editor-header"> <div class="gcr-ext-editor-horizontal"> <div> <input id="gcrExtNewTitle" class="gcr-ext-editor-answer-title gcr-ext-editor-answer-half" placeholder="You go get \'em tiger!"> <textarea id="gcrExtNewText" class="gcr-ext-editor-answer-text gcr-ext-editor-answer-half" style="height: 100px" placeholder="You\'re the best! So select a response"></textarea> </div> <div> <div class="gcr-ext-editor-answer-text" style="font-size: 14px"><span class="gcr-ext-editor-pink">⇠</span> This is an easy title to remember this canned response by</div><br> <div class="gcr-ext-editor-answer-text" style="font-size: 14px"><span class="gcr-ext-editor-pink">⇠</span> And this is the actual content that will be inserted</div><br> <button id="gcrExtNewButton" class="btn btn-sm btn-primary">Can it!</button> <span id="gcrExtNewError" class="gcr-ext-editor-status-message" hidden>No empty canned responses!</span> <span id="gcrExtNewConfirm" class="gcr-ext-editor-status-message" hidden>Added!</span> </div> </div> </div> <div class="gcr-ext-editor-list"> <ul id="gcrExtAnswerList"></ul> </div></div>';

            var closeBar = dialog.querySelector('.gcr-ext-editor-close');

            var closeText = createNodeWithClass('span', 'select-menu-title');
            closeText.innerHTML = 'Edit or add canned responses';
            closeText.style.float = 'left';
            closeText.style.padding = '5px 10px';
            closeText.style.color = 'black';
            closeText.style.fontWeight = 'bold';

            var closeButton = createNodeWithClass('button', 'btn-link delete-button');
            closeButton.type = 'button';
            closeButton.style.padding = '5px 10px';
            closeButton.style.float = 'right';
            var svg = createSVG(16, 16, 'octicon-x', 'M7.48 8l3.75 3.75-1.48 1.48-3.75-3.75-3.75 3.75-1.48-1.48 3.75-3.75L0.77 4.25l1.48-1.48 3.75 3.75 3.75-3.75 1.48 1.48-3.75 3.75z');
            closeButton.appendChild(svg);
            closeButton.addEventListener('click', function () {
                document.body.removeChild(dialog);
            });

            closeBar.appendChild(closeText);
            closeBar.appendChild(closeButton);
            document.body.appendChild(dialog);

            window.gcrExtEditorSaveAnswers = function () {
                chrome.runtime.sendMessage({ action: 'save', answers: __gcrExtAnswers }, function (response) {
                    addAnswerButton();
                });
            };

            gcrExtEditorSetup();
            gcrExtEditorUpdateAnswersList();
        }
    }, 200);
}
)();
