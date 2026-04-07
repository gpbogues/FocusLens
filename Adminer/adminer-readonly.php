<?php
//Adminer Read-Only (should be): for checking tables and values they hold

class AdminerReadOnly {

    //Block forbidden pages by redirecting away, http url related, 
    //kinda like preventing injections from search bar 
    function headers() {
        $blocked = ['sql', 'create', 'alter', 'drop', 'dump', 'import',
                    'table', 'indexes', 'foreign', 'triggers', 'schema',
                    'sequence', 'type', 'procedure', 'event', 'user'];

        foreach ($blocked as $page) {
            if (isset($_GET[$page])) {
                header("Location: ?");
                exit;
            }
        }
    }

    //Block write SQL queries from server side 
    function query($query) {
        $forbidden = '/^\s*(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|RENAME|REPLACE|CALL|EXEC|GRANT|REVOKE|LOCK|UNLOCK|LOAD|IMPORT)\b/i';
        if (preg_match($forbidden, $query)) {
            return false;
        }
        return $query;
    }

    //Block imports
    function importServerPath() {
        return '';
    }

    //Hide all non-data UI elements
    function head() {
        ?>
<style>
    #content form[action*="edit"],
    #content form[action*="create"],
    #content form[action*="drop"],
    #content form[action*="alter"],
    #content form[action*="import"],
    #content a[href*="create"],
    #content a[href*="drop"],
    #content a[href*="alter"],
    #content a[href*="edit"],
    #content a[href*="import"],
    a[href*="&create="],
    a[href*="&drop="],
    a[href*="&alter="],
    a[href*="&edit="],
    a[href*="&dump="],
    a[href*="&sql="],
    a[href*="&import="],
    a[href*="&schema="],
    a[href*="&indexes="],
    a[href*="&foreign="],
    a[href*="&triggers="],
    input[name="drop"],
    input[name="save"],
    input[value="Save"],
    input[value="Drop"],
    input[value="Delete"],
    input[value="Insert"],
    input[value="Execute"],
    input[value="Export"],
    input[value="Import"],
    #content .add,
    .add-row,
    td a[href*="edit="],
    td a[href*="delete="],
    tr.footer td a {
        display: none !important;
    }

    #menu a[href*="sql="],
    #menu a[href*="dump="],
    #menu a[href*="import="],
    #menu a[href*="schema="],
    #menu a[href*="create="] {
        display: none !important;
    }

    #readonly-banner {
        background: #1a1a2e;
        color: #e2e8f0;
        text-align: center;
        padding: 8px 16px;
        font-family: monospace;
        font-size: 13px;
        letter-spacing: 0.05em;
        border-bottom: 2px solid #4f46e5;
    }

    #readonly-banner span {
        background: #4f46e5;
        color: white;
        padding: 2px 8px;
        border-radius: 4px;
        margin-right: 8px;
        font-weight: bold;
    }
</style>

<script>
document.addEventListener("DOMContentLoaded", function () {
    var banner = document.createElement("div");
    banner.id = "readonly-banner";
    banner.innerHTML = '<span>READ-ONLY</span> View table data only. All modifications are disabled.';
    document.body.insertBefore(banner, document.body.firstChild);

    document.querySelectorAll('a[href*="table="]').forEach(function(el) {
        el.href = el.href.replace("table=", "select=");
    });

    document.querySelectorAll(
        'a[href*="edit="], a[href*="delete="], a[href*="&edit=new"], ' +
        'a[href*="sql="], a[href*="dump="], a[href*="import="], ' +
        'a[href*="schema="], a[href*="indexes="], a[href*="foreign="], ' +
        'a[href*="triggers="], a[href*="create="]'
    ).forEach(function(el) {
        el.parentElement && el.parentElement.removeChild(el);
    });

    document.querySelectorAll('input[type="submit"]').forEach(function(btn) {
        var val = (btn.value || "").toLowerCase();
        var blocked = ["save","delete","drop","insert","execute","import","export","alter","create"];
        if (blocked.some(function(a){ return val.includes(a); })) {
            btn.disabled = true;
            btn.style.opacity = "0.3";
            btn.style.cursor = "not-allowed";
            btn.title = "Disabled in read-only mode";
        }
    });

    document.querySelectorAll('form').forEach(function(form) {
        form.addEventListener("submit", function(e) {
            var textarea = form.querySelector("textarea");
            if (textarea) {
                var sql = textarea.value.trim().toUpperCase();
                if (/^(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|RENAME|REPLACE|CALL|EXEC|GRANT|REVOKE|LOCK|UNLOCK)/.test(sql)) {
                    e.preventDefault();
                    alert("Blocked: only SELECT queries allowed");
                }
            }
        });
    });
});
</script>
        <?php
        return true;
    }
}

//Bootstrap
function adminer_object() {
    include_once "./plugins/plugin.php";
    return new AdminerPlugin([new AdminerReadOnly()]);
}

include "./adminer.php";