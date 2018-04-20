/* eslint-disable no-undef, no-unused-vars */

Zepto(function ($) {
    new ClipboardJS('.copy', {
        text: function (e) {
            return e.getAttribute('data-clipboard-text');
        }
    });
});

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

function generate() {
    var username = $('#usernameTextbox').val();
    var buckets = $('#bucketSelect').val();
    var artifactsCreate = $('#createCheckbox').prop('checked');
    var artifactUpdate = $('#updateCheckbox').prop('checked');
    var artifactRemove = $('#removeCheckbox').prop('checked');

    $('#usernameAlert').hide();
    $('#bucketsAlert').hide();

    var invalid = false;

    if (!username) {
        invalid = true;
        $('#usernameAlert').show();
    }

    if (buckets.length == 0) {
        invalid = true;
        $('#bucketsAlert').show();
    }

    if (invalid) return;

    $('#generateButton').addClass('is-loading');

    $.ajax({
        type: 'POST',
        url: '/api/tokens/grants',
        data: JSON.stringify({
            username: username,
            grants: {
                buckets: buckets,
                artifactsCreate: artifactsCreate,
                artifactUpdate: artifactUpdate,
                artifactRemove: artifactRemove
            }
        }),
        contentType: 'application/json',
        success: function (data) {
            $('#generateButton').removeClass('is-loading');
            $('#token').val(data.token);            
        },
        error: function (xhr) {
            $('#generateButton').removeClass('is-loading');
            var responseObject = JSON.parse(xhr.response);
            message(responseObject.message, 'error', true);
        }
    });
}

function logout() {
    cookie.remove('authorization');
    window.location.href = '/';
}