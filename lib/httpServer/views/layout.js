/* eslint-disable no-undef, no-unused-vars */

Zepto(function ($) {
    new ClipboardJS('.copy', {
        text: function (e) {
            return e.getAttribute('data-clipboard-text');
        }
    });
})

function searchArtifact(e) {
    // TODO: Change document.getElementById for zepto
    var bucketSelect = document.getElementById('bucketSelect');
    var bucket = bucketSelect[bucketSelect.selectedIndex].value;
    var artifact = document.getElementById('artifactTextbox').value;
    var version = document.getElementById('versionTextbox').value;
    var metadata = document.getElementById('metadataTextbox').value;

    var url = '/artifacts/search?partial=true';

    if (bucket) url += '&bucket=' + bucket;
    if (artifact) url += '&artifact=' + artifact;
    if (version) url += '&version=' + version;
    if (metadata) url += '&' + metadata.replace(/,/g, '&');
    window.location.href = url;
    e.preventDefault();
}