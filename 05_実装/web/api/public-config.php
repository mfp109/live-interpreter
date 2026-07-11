<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
$legal=$config['legal']??[];
$safe=[];foreach(['seller_name','address','phone','email'] as $key){$value=(string)($legal[$key]??'');$safe[$key]=($value===''||$value==='CHANGE_ME')?null:$value;}
json_response(['ok'=>true,'operator'=>'ShalomWorks','legal'=>$safe,'terms_version'=>'2026-07-11']);
