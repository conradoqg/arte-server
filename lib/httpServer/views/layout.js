/* eslint-disable no-undef, no-unused-vars */

Zepto(function ($) {
    new ClipboardJS('.copy', {
        text: function (e) {
            return e.getAttribute('data-clipboard-text');
        }
    });
});

function searchArtifact(e) {
    var bucket = $('#bucketSelect').val();
    var artifact = $('#artifactTextbox').val();
    var version = $('#versionTextbox').val();
    var metadata = $('#metadataTextbox').val();

    var url = '/artifacts/search?partial=true';

    if (bucket) url += '&bucket=' + bucket;
    if (artifact) url += '&artifact=' + artifact;
    if (version) url += '&version=' + version;
    if (metadata) url += '&' + metadata.replace(/,/g, '&');
    window.location.href = url;
    e.preventDefault();
}