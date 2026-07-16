<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/stripe.php';
require_once dirname(__DIR__) . '/lib/products.php';
require_method('POST');
$user=require_user($config);
require_csrf();
$pdo=db($config);
$subscription=active_subscription($pdo,(string)$user['id']);
if(!$subscription)json_error('SUBSCRIPTION_NOT_FOUND','No subscription is available to manage.',404);

try{
    $configurations=stripe_request($config,'GET','/v1/billing_portal/configurations',[
        'active'=>'true','limit'=>20,
    ]);
    $portalConfiguration=null;
    foreach(($configurations['data']??[]) as $candidate){
        if(!empty($candidate['features']['subscription_cancel']['enabled'])){
            $portalConfiguration=(string)($candidate['id']??'');
            break;
        }
    }
    if(!$portalConfiguration)throw new RuntimeException('PORTAL_CONFIGURATION_MISSING');
    $session=stripe_request($config,'POST','/v1/billing_portal/sessions',[
        'customer'=>$subscription['stripe_customer_id'],
        'configuration'=>$portalConfiguration,
        'return_url'=>rtrim($config['app_url'],'/').'/account',
    ],'portal:'.$user['id'].':'.gmdate('YmdHi'));
    json_response(['ok'=>true,'portal_url'=>$session['url']]);
}catch(Throwable $error){
    error_log('billing portal creation failed user='.$user['id'].' error='.$error->getMessage());
    json_error('PAYMENT_PROVIDER_ERROR','Subscription management could not be opened.',502);
}
