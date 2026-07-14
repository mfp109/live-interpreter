import assert from "node:assert/strict";
import test from "node:test";
import { buildPreparationRequest, extractPreparationBrief, generatePreparationBrief } from "../src/preparation.mjs";

const input={user_id:"user-1",source_language:"ja",target_language:"en",situation:"Church service",purpose:"Clear interpretation",key_terms:"grace",locale:"ja"};
const brief={summary:"概要",terms:[{source:"恵み",translation:"grace",note:"文脈に注意"}],risks:["固有名詞"],speaking_tips:["短く区切る"],checklist:["名前を確認"]};

test("builds a non-stored GPT-5.6 structured request",()=>{
  const request=buildPreparationRequest(input);
  assert.equal(request.model,"gpt-5.6");
  assert.equal(request.store,false);
  assert.equal(request.text.format.type,"json_schema");
  assert.equal(request.text.format.strict,true);
  assert.match(request.instructions,/Japanese/);
});

test("extracts a structured brief",()=>{
  assert.deepEqual(extractPreparationBrief({output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(brief)}]}]}),brief);
});

test("calls the Responses API and parses output",async()=>{
  const fakeFetch=async(url,options)=>{
    assert.equal(url,"https://api.openai.com/v1/responses");
    assert.match(options.headers.Authorization,/Bearer test-key/);
    return {ok:true,status:200,json:async()=>({output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(brief)}]}]})};
  };
  assert.deepEqual(await generatePreparationBrief(input,"test-key",fakeFetch),brief);
});
