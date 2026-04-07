<?php
//Adminer plugin, base class 
class AdminerPlugin extends Adminer {
    protected $plugins;

    function __construct(array $plugins) {
        $this->plugins = $plugins;
    }

    function _call($function, $args) {
        $return = null;
        foreach ($this->plugins as $plugin) {
            if (method_exists($plugin, $function)) {
                $return = call_user_func_array([$plugin, $function], $args);
                if ($return !== null) {
                    return $return;
                }
            }
        }
        return call_user_func_array(['parent', $function], $args);
    }

    function loginForm() { return $this->_call('loginForm', []); }
    function login($login, $password) { return $this->_call('login', [$login, $password]); }
    function credentials() { return $this->_call('credentials', []); }
    function database() { return $this->_call('database', []); }
    function query($query) { return $this->_call('query', [$query]); }
    function importServerPath() { return $this->_call('importServerPath', []); }
    function head() { return $this->_call('head', []); }
    function csp() { return $this->_call('csp', []); }
    function name() { return $this->_call('name', []); }
    function permanentLogin($create = false) { return $this->_call('permanentLogin', [$create]); }
    function connectSsl() { return $this->_call('connectSsl', []); }
    function tableName($tableStatus) { return $this->_call('tableName', [$tableStatus]); }
    function fieldName($field, $order = 0) { return $this->_call('fieldName', [$field, $order]); }
    function selectLink($val, $field) { return $this->_call('selectLink', [$val, $field]); }
    function dumpFormat() { return $this->_call('dumpFormat', []); }
    function dumpOutput() { return $this->_call('dumpOutput', []); }
}