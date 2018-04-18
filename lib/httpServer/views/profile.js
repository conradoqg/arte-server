/* eslint-disable no-undef, no-unused-vars */

Zepto(function ($) {
    new ClipboardJS('.copy', {
        text: function (e) {
            return e.getAttribute('data-clipboard-text');
        }
    });
});