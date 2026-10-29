import test from 'node:test';import assert from 'node:assert/strict';import {unpack} from '../mcp-client.mjs';
test('MCP creation payload survives a separate informational text block',()=>{assert.deepEqual(unpack({content:[{type:'text',text:'{"threadId":"native-id","hostId":"local"}'},{type:'text',text:'Desktop task created.'}]}),{threadId:'native-id',hostId:'local'});});
test('MCP errors remain failures even when their content contains JSON',()=>{assert.throws(()=>unpack({isError:true,content:[{type:'text',text:'{"error":"Creation refused"}'}]}),/Creation refused/);});
