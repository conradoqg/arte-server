/* eslint-disable no-undef, no-unused-vars */

function message(text, type, show) {
    var messageBox = $('#messageBox');
    var messageText = $('#messageText');

    if (!text) text = '';
    if (!type) type = 'info';
    if (show == null) show = false;

    var setTypeClass = function (type) {
        messageBox.removeClass('is-info is-success is-danger');
        messageBox.addClass(type);
    };

    if (type == 'info') setTypeClass('is-info');
    else if (type == 'success') setTypeClass('is-success');
    else if (type == 'error') setTypeClass('is-danger');

    messageText.text(text);

    if (show) messageBox.show();
    else messageBox.hide();

    setTimeout(function () { messageBox.hide(); }, 5000);
}

function login() {
    var username = $('#usernameTextbox').get(0).value;
    var password = $('#passwordTextbox').get(0).value;
    var token = $('#tokenTextbox').get(0).value;

    $('#usernameAlert').hide();
    $('#passwordAlert').hide();

    if (!token) {
        var invalid = false;

        if (!username) {
            invalid = true;
            $('#usernameAlert').show();
        }

        if (!password) {
            invalid = true;
            $('#passwordAlert').show();
        }

        if (invalid) return;
    }

    $('#loginButton').addClass('is-loading');

    var createCookie = function (token) {
        cookie.set({
            authorization: token
        }, { expires: 90 });
    };

    if (token) {
        $.ajax({
            type: 'get',
            url: '/api/tokens/' + token,
            contentType: 'application/json',
            success: function () {
                $('#loginButton').removeClass('is-loading');
                createCookie(token);
                window.location.href = '/';
            },
            error: function (xhr) {
                $('#loginButton').removeClass('is-loading');
                var responseObject = JSON.parse(xhr.response);
                message(responseObject.message, 'error', true);
            }
        });
    } else {
        $.ajax({
            type: 'POST',
            url: '/api/tokens',
            data: JSON.stringify({ username: username, password: password }),
            contentType: 'application/json',
            success: function (data) {
                $('#loginButton').removeClass('is-loading');
                createCookie(data.token);
                window.location.href = '/';
            },
            error: function (xhr) {
                $('#loginButton').removeClass('is-loading');
                var responseObject = JSON.parse(xhr.response);
                message(responseObject.message, 'error', true);
            }
        });
    }
}

function logout() {
    cookie.remove('authorization');
    window.location.href = '/';
}