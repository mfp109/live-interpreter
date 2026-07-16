<?php
declare(strict_types=1);

header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');

require __DIR__.'/bootstrap.php';
require_once __DIR__.'/lib/stripe.php';
require_method('POST');

const SETUP_TOKEN_HASH='065378150ed6b826589026a7c5c217ddba92382d9334ff39a258bc197ed255fa';
$token=trim((string)(json_body()['token']??''));
if(!hash_equals(SETUP_TOKEN_HASH,hash('sha256',$token))){
    json_error('SETUP_TOKEN_INVALID','Invalid setup token.',403);
}

try{
    $requiredEvents=[
        'checkout.session.completed','charge.refunded','charge.dispute.created',
        'refund.updated','refund.failed','invoice.paid','invoice.payment_failed',
        'customer.subscription.updated','customer.subscription.deleted',
    ];
    $webhooks=stripe_request($config,'GET','/v1/webhook_endpoints',['limit'=>100]);
    $expectedUrl=rtrim((string)$config['app_url'],'/').'/api/stripe/webhook.php';
    $webhook=null;
    foreach(($webhooks['data']??[]) as $candidate){
        if(rtrim((string)($candidate['url']??''),'/')===rtrim($expectedUrl,'/')){
            $webhook=$candidate;
            break;
        }
    }
    if(!$webhook)throw new RuntimeException('WEBHOOK_ENDPOINT_NOT_FOUND');
    $enabled=(array)($webhook['enabled_events']??[]);
    if(!in_array('*',$enabled,true)){
        $enabled=array_values(array_unique(array_merge($enabled,$requiredEvents)));
        sort($enabled);
        $fields=[];
        foreach($enabled as $index=>$event)$fields['enabled_events['.$index.']']=$event;
        $webhook=stripe_request($config,'POST','/v1/webhook_endpoints/'.rawurlencode((string)$webhook['id']),$fields,'subscription-events-v1');
    }

    $configurations=stripe_request($config,'GET','/v1/billing_portal/configurations',['active'=>'true','limit'=>100]);
    $portal=null;
    foreach(($configurations['data']??[]) as $candidate){
        if(!empty($candidate['features']['subscription_cancel']['enabled'])){
            $portal=$candidate;
            break;
        }
    }
    if(!$portal){
        $base=rtrim((string)$config['app_url'],'/');
        $portal=stripe_request($config,'POST','/v1/billing_portal/configurations',[
            'default_return_url'=>$base.'/account',
            'business_profile[headline]'=>'ShalomWorks Live Interpreter',
            'business_profile[privacy_policy_url]'=>$base.'/privacy',
            'business_profile[terms_of_service_url]'=>$base.'/terms',
            'features[customer_update][enabled]'=>'false',
            'features[invoice_history][enabled]'=>'true',
            'features[payment_method_update][enabled]'=>'true',
            'features[subscription_cancel][enabled]'=>'true',
            'features[subscription_cancel][mode]'=>'at_period_end',
            'features[subscription_cancel][proration_behavior]'=>'none',
            'features[subscription_cancel][cancellation_reason][enabled]'=>'false',
            'features[subscription_update][enabled]'=>'false',
        ],'subscription-portal-v1');
    }

    @unlink(__FILE__);
    json_response([
        'ok'=>true,
        'livemode'=>(bool)($webhook['livemode']??false),
        'webhook_id'=>$webhook['id']??null,
        'enabled_events'=>$webhook['enabled_events']??[],
        'portal_configuration_id'=>$portal['id']??null,
        'subscription_cancel_enabled'=>(bool)($portal['features']['subscription_cancel']['enabled']??false),
    ]);
}catch(Throwable $error){
    error_log('Stripe subscription setup failed: '.$error->getMessage());
    json_error('STRIPE_SETUP_FAILED','Stripe subscription setup failed.',500);
}
