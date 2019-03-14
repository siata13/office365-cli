import commands from '../../commands';
import Command, { CommandOption, CommandError, CommandTypes, CommandValidate } from '../../../../Command';
import * as sinon from 'sinon';
import appInsights from '../../../../appInsights';
import auth, { Site } from '../../SpoAuth';
const command: Command = require('./contenttype-field-remove');
import * as assert from 'assert';
import * as request from 'request-promise-native';
import Utils from '../../../../Utils';

const WEB_URL = 'https://contoso.sharepoint.com';
const FIELD_LINK_ID = "5ee2dd25-d941-455a-9bdb-7f2c54aed11b";
const CONTENT_TYPE_ID = "0x0100558D85B7216F6A489A499DB361E1AE2F";
const WEB_ID = "d1b7a30d-7c22-4c54-a686-f1c298ced3c7";
const SITE_ID = "50720268-eff5-48e0-835e-de588b007927";

describe(commands.CONTENTTYPE_FIELD_REMOVE, () => {
  let vorpal: Vorpal;
  let log: string[];
  let cmdInstance: any;
  let cmdInstanceLogSpy: sinon.SinonSpy;
  let trackEvent: any;
  let telemetry: any;

  before(() => {
    sinon.stub(auth, 'restoreAuth').callsFake(() => Promise.resolve());
    sinon.stub(auth, 'getAccessToken').callsFake(() => { return Promise.resolve('ABC'); });
    sinon.stub(command as any, 'getRequestDigestForSite').callsFake(() => Promise.resolve({ FormDigestValue: 'ABC' }));
    trackEvent = sinon.stub(appInsights, 'trackEvent').callsFake((t) => {
      telemetry = t;
    });
  });

  beforeEach(() => {
    vorpal = require('../../../../vorpal-init');
    log = [];
    cmdInstance = {
      log: (msg: string) => {
        log.push(msg);
      }
    };
    cmdInstanceLogSpy = sinon.spy(cmdInstance, 'log');
    auth.site = new Site();
    telemetry = null;
    (command as any).requestDigest = '';
    (command as any).webId = '';
    (command as any).siteId = '';
    (command as any).fieldLinkId = '';
  });

  afterEach(() => {
    Utils.restore([
      vorpal.find,
      request.get,
      request.post
    ]);
  });

  after(() => {
    Utils.restore([
      appInsights.trackEvent,
      auth.getAccessToken,
      auth.restoreAuth,
      (command as any).getRequestDigestForSite
    ]);
  });

  it('has correct name', () => {
    assert.equal(command.name.startsWith(commands.CONTENTTYPE_FIELD_REMOVE), true);
  });

  it('has a description', () => {
    assert.notEqual(command.description, null);
  });

  it('calls telemetry', (done) => {
    cmdInstance.action = command.action();
    cmdInstance.action({ options: {} }, () => {
      try {
        assert(trackEvent.called);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('logs correct telemetry event', (done) => {
    cmdInstance.action = command.action();
    cmdInstance.action({ options: {} }, () => {
      try {
        assert.equal(telemetry.name, commands.CONTENTTYPE_FIELD_REMOVE);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('aborts when not logged in to a SharePoint site', (done) => {
    auth.site = new Site();
    auth.site.connected = false;
    cmdInstance.action = command.action();
    cmdInstance.action({ options: { debug: true } }, (err?: any) => {
      try {
        assert.equal(JSON.stringify(err), JSON.stringify(new CommandError('Log in to a SharePoint Online site first')));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('configures command types', () => {
    assert.notEqual(typeof command.types(), 'undefined', 'command types undefined');
    assert.notEqual((command.types() as CommandTypes).string, 'undefined', 'command string types undefined');
  });

  it('supports debug mode', () => {
    const options = (command.options() as CommandOption[]);
    let containsOption = false;
    options.forEach(o => {
      if (o.option === '--debug') {
        containsOption = true;
      }
    });
    assert(containsOption);
  });

  it('configures contentTypeId as string option', () => {
    const types = (command.types() as CommandTypes);
    ['i', 'contentTypeId'].forEach(o => {
      assert.notEqual((types.string as string[]).indexOf(o), -1, `option ${o} not specified as string`);
    });
  });

  it('has help referring to the right command', () => {
    const cmd: any = {
      log: (msg: string) => { },
      prompt: () => { },
      helpInformation: () => { }
    };
    const find = sinon.stub(vorpal, 'find').callsFake(() => cmd);
    cmd.help = command.help();
    cmd.help({}, () => { });
    assert(find.calledWith(commands.CONTENTTYPE_FIELD_REMOVE));
  });

  it('removes the field link from web content type with update child content types', (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url.indexOf(`_api/site?$select=Id`) > -1) {
        return Promise.resolve({
          "Id": SITE_ID
        });
      }
      if (opts.url.indexOf(`_api/web?$select=Id`) > -1) {
        return Promise.resolve({
          "Id": WEB_ID
        });
      }

      return Promise.reject('Invalid request');
    });

    sinon.stub(request, 'post').callsFake((opts) => {
      if (opts.url.indexOf(`/_vti_bin/client.svc/ProcessQuery`) > -1) {
        if (opts.body === `<Request AddExpandoFieldTypeSuffix="true" SchemaVersion="15.0.0.0" LibraryVersion="16.0.0.0" ApplicationName=".NET Library" xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009"><Actions><ObjectPath Id="77" ObjectPathId="76" /><ObjectPath Id="79" ObjectPathId="78" /><Method Name="DeleteObject" Id="80" ObjectPathId="78" /><Method Name="Update" Id="81" ObjectPathId="24"><Parameters><Parameter Type="Boolean">true</Parameter></Parameters></Method></Actions><ObjectPaths><Property Id="76" ParentId="24" Name="FieldLinks" /><Method Id="78" ParentId="76" Name="GetById"><Parameters><Parameter Type="Guid">{${FIELD_LINK_ID}}</Parameter></Parameters></Method><Identity Id="24" Name="6b3ec69e-00a7-0000-55a3-61f8d779d2b3|740c6a0b-85e2-48a0-a494-e0f1759d4aa7:site:${SITE_ID}:web:${WEB_ID}:contenttype:${CONTENT_TYPE_ID}" /></ObjectPaths></Request>`) {
          return Promise.resolve(`[
              {
                "SchemaVersion": "15.0.0.0",
                "LibraryVersion": "16.0.7911.1206",
                "ErrorInfo": null,
                "TraceCorrelationId": "73557d9e-007f-0000-22fb-89971360c85c"
              }
            ]`);
        }
      }

      return Promise.reject('Invalid request');
    });


    auth.site = new Site();
    auth.site.connected = true;
    auth.site.url = WEB_URL;
    cmdInstance.action = command.action();
    cmdInstance.action({ options: { debug: false, webUrl: WEB_URL, contentTypeId: CONTENT_TYPE_ID, fieldLinkId: FIELD_LINK_ID, updateChildContentTypes: true } }, (err?: any) => {
      try {
        assert(cmdInstanceLogSpy.notCalled);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });
  it('removes the field link from web content type with update child content types (debug)', (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url.indexOf(`_api/site?$select=Id`) > -1) {
        return Promise.resolve({
          "Id": SITE_ID
        });
      }
      if (opts.url.indexOf(`_api/web?$select=Id`) > -1) {
        return Promise.resolve({
          "Id": WEB_ID
        });
      }

      return Promise.reject('Invalid request');
    });

    sinon.stub(request, 'post').callsFake((opts) => {
      if (opts.url.indexOf(`/_vti_bin/client.svc/ProcessQuery`) > -1) {
        if (opts.body === `<Request AddExpandoFieldTypeSuffix="true" SchemaVersion="15.0.0.0" LibraryVersion="16.0.0.0" ApplicationName=".NET Library" xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009"><Actions><ObjectPath Id="77" ObjectPathId="76" /><ObjectPath Id="79" ObjectPathId="78" /><Method Name="DeleteObject" Id="80" ObjectPathId="78" /><Method Name="Update" Id="81" ObjectPathId="24"><Parameters><Parameter Type="Boolean">true</Parameter></Parameters></Method></Actions><ObjectPaths><Property Id="76" ParentId="24" Name="FieldLinks" /><Method Id="78" ParentId="76" Name="GetById"><Parameters><Parameter Type="Guid">{${FIELD_LINK_ID}}</Parameter></Parameters></Method><Identity Id="24" Name="6b3ec69e-00a7-0000-55a3-61f8d779d2b3|740c6a0b-85e2-48a0-a494-e0f1759d4aa7:site:${SITE_ID}:web:${WEB_ID}:contenttype:${CONTENT_TYPE_ID}" /></ObjectPaths></Request>`) {
          return Promise.resolve(`[
              {
                "SchemaVersion": "15.0.0.0",
                "LibraryVersion": "16.0.7911.1206",
                "ErrorInfo": null,
                "TraceCorrelationId": "73557d9e-007f-0000-22fb-89971360c85c"
              }
            ]`);
        }
      }

      return Promise.reject('Invalid request');
    });


    auth.site = new Site();
    auth.site.connected = true;
    auth.site.url = WEB_URL;
    cmdInstance.action = command.action();
    cmdInstance.action({ options: { debug: true, webUrl: WEB_URL, contentTypeId: CONTENT_TYPE_ID, fieldLinkId: FIELD_LINK_ID, updateChildContentTypes: true } }, (err?: any) => {
      try {
        assert(cmdInstanceLogSpy.calledWith(vorpal.chalk.green('DONE')));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('removes the field link from web content type without update child content types', (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url.indexOf(`_api/site?$select=Id`) > -1) {
        return Promise.resolve({
          "Id": SITE_ID
        });
      }
      if (opts.url.indexOf(`_api/web?$select=Id`) > -1) {
        return Promise.resolve({
          "Id": WEB_ID
        });
      }

      return Promise.reject('Invalid request');
    });

    sinon.stub(request, 'post').callsFake((opts) => {
      if (opts.url.indexOf(`/_vti_bin/client.svc/ProcessQuery`) > -1) {
        if (opts.body === `<Request AddExpandoFieldTypeSuffix="true" SchemaVersion="15.0.0.0" LibraryVersion="16.0.0.0" ApplicationName=".NET Library" xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009"><Actions><ObjectPath Id="77" ObjectPathId="76" /><ObjectPath Id="79" ObjectPathId="78" /><Method Name="DeleteObject" Id="80" ObjectPathId="78" /><Method Name="Update" Id="81" ObjectPathId="24"><Parameters><Parameter Type="Boolean">false</Parameter></Parameters></Method></Actions><ObjectPaths><Property Id="76" ParentId="24" Name="FieldLinks" /><Method Id="78" ParentId="76" Name="GetById"><Parameters><Parameter Type="Guid">{${FIELD_LINK_ID}}</Parameter></Parameters></Method><Identity Id="24" Name="6b3ec69e-00a7-0000-55a3-61f8d779d2b3|740c6a0b-85e2-48a0-a494-e0f1759d4aa7:site:${SITE_ID}:web:${WEB_ID}:contenttype:${CONTENT_TYPE_ID}" /></ObjectPaths></Request>`) {
          return Promise.resolve(`[
              {
                "SchemaVersion": "15.0.0.0",
                "LibraryVersion": "16.0.7911.1206",
                "ErrorInfo": null,
                "TraceCorrelationId": "73557d9e-007f-0000-22fb-89971360c85c"
              }
            ]`);
        }
      }

      return Promise.reject('Invalid request');
    });


    auth.site = new Site();
    auth.site.connected = true;
    auth.site.url = WEB_URL;
    cmdInstance.action = command.action();
    cmdInstance.action({ options: { debug: false, webUrl: WEB_URL, contentTypeId: CONTENT_TYPE_ID, fieldLinkId: FIELD_LINK_ID, updateChildContentTypes: false } }, (err?: any) => {
      try {
        assert(cmdInstanceLogSpy.notCalled);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });
  it('removes the field link from web content type without update child content types (debug)', (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url.indexOf(`_api/site?$select=Id`) > -1) {
        return Promise.resolve({
          "Id": WEB_ID
        });
      }
      if (opts.url.indexOf(`_api/web?$select=Id`) > -1) {
        return Promise.resolve({
          "Id": SITE_ID
        });
      }

      return Promise.reject('Invalid request');
    });

    sinon.stub(request, 'post').callsFake((opts) => {
      if (opts.url.indexOf(`/_vti_bin/client.svc/ProcessQuery`) > -1) {
        if (opts.body === `<Request AddExpandoFieldTypeSuffix="true" SchemaVersion="15.0.0.0" LibraryVersion="16.0.0.0" ApplicationName=".NET Library" xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009"><Actions><ObjectPath Id="77" ObjectPathId="76" /><ObjectPath Id="79" ObjectPathId="78" /><Method Name="DeleteObject" Id="80" ObjectPathId="78" /><Method Name="Update" Id="81" ObjectPathId="24"><Parameters><Parameter Type="Boolean">false</Parameter></Parameters></Method></Actions><ObjectPaths><Property Id="76" ParentId="24" Name="FieldLinks" /><Method Id="78" ParentId="76" Name="GetById"><Parameters><Parameter Type="Guid">{${FIELD_LINK_ID}}</Parameter></Parameters></Method><Identity Id="24" Name="6b3ec69e-00a7-0000-55a3-61f8d779d2b3|740c6a0b-85e2-48a0-a494-e0f1759d4aa7:site:50720268-eff5-48e0-835e-de588b007927:web:d1b7a30d-7c22-4c54-a686-f1c298ced3c7:contenttype:${CONTENT_TYPE_ID}" /></ObjectPaths></Request>`) {
          return Promise.resolve(`[
              {
                "SchemaVersion": "15.0.0.0",
                "LibraryVersion": "16.0.7911.1206",
                "ErrorInfo": null,
                "TraceCorrelationId": "73557d9e-007f-0000-22fb-89971360c85c"
              }
            ]`);
        }
      }

      return Promise.reject('Invalid request');
    });


    auth.site = new Site();
    auth.site.connected = true;
    auth.site.url = WEB_URL;
    cmdInstance.action = command.action();
    cmdInstance.action({ options: {debug: true, webUrl: WEB_URL, contentTypeId: CONTENT_TYPE_ID, fieldLinkId: FIELD_LINK_ID, updateChildContentTypes: false } }, (err?: any) => {
      try {
        assert(cmdInstanceLogSpy.calledWith(vorpal.chalk.green('DONE')));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  
  it('handles error when remove the field link from web content type with update child content types', (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url.indexOf(`_api/site?$select=Id`) > -1) {
        return Promise.resolve({
          "Id": SITE_ID
        });
      }
      if (opts.url.indexOf(`_api/web?$select=Id`) > -1) {
        return Promise.resolve({
          "Id": WEB_ID
        });
      }

      return Promise.reject('Invalid request');
    });

    sinon.stub(request, 'post').callsFake((opts) => {
      if (opts.url.indexOf(`/_vti_bin/client.svc/ProcessQuery`) > -1) {
        console.log(`Received: ${opts.body}`);

        const expectedBody = `<Request AddExpandoFieldTypeSuffix="true" SchemaVersion="15.0.0.0" LibraryVersion="16.0.0.0" ApplicationName=".NET Library" xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009"><Actions><ObjectPath Id="77" ObjectPathId="76" /><ObjectPath Id="79" ObjectPathId="78" /><Method Name="DeleteObject" Id="80" ObjectPathId="78" /><Method Name="Update" Id="81" ObjectPathId="24"><Parameters><Parameter Type="Boolean">true</Parameter></Parameters></Method></Actions><ObjectPaths><Property Id="76" ParentId="24" Name="FieldLinks" /><Method Id="78" ParentId="76" Name="GetById"><Parameters><Parameter Type="Guid">{${FIELD_LINK_ID}}</Parameter></Parameters></Method><Identity Id="24" Name="6b3ec69e-00a7-0000-55a3-61f8d779d2b3|740c6a0b-85e2-48a0-a494-e0f1759d4aa7:site:${SITE_ID}:web:${WEB_ID}:contenttype:${CONTENT_TYPE_ID}" /></ObjectPaths></Request>`;
        console.log(`Expected: ${expectedBody}`);

        if (opts.body === expectedBody) {
          return Promise.resolve(`[
              {
                "SchemaVersion": "15.0.0.0",
                "LibraryVersion": "16.0.7911.1206",
                "ErrorInfo": {
                  "ErrorMessage": "Unknown Error", "ErrorValue": null, "TraceCorrelationId": "b33c489e-009b-5000-8240-a8c28e5fd8b4", "ErrorCode": -1, "ErrorTypeName": "Microsoft.SharePoint.Client.UnknownError"
                },
                "TraceCorrelationId": "e5547d9e-705d-0000-22fb-8faca5696ed8"
              }
            ]`);
        }
      }

      return Promise.reject('Invalid request');
    });


    auth.site = new Site();
    auth.site.connected = true;
    auth.site.url = WEB_URL;
    cmdInstance.action = command.action();
    cmdInstance.action({ options: { debug: false, webUrl: WEB_URL, contentTypeId: CONTENT_TYPE_ID, fieldLinkId: FIELD_LINK_ID, updateChildContentTypes: true } }, (err?: any) => {
      try {
        assert.equal(JSON.stringify(err), JSON.stringify(new CommandError('Unknown Error')));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });
  it('handles error when remove the field link from web content type with update child content types (debug)', (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url.indexOf(`_api/site?$select=Id`) > -1) {
        return Promise.resolve({
          "Id": SITE_ID
        });
      }
      if (opts.url.indexOf(`_api/web?$select=Id`) > -1) {
        return Promise.resolve({
          "Id": WEB_ID
        });
      }

      return Promise.reject('Invalid request');
    });

    sinon.stub(request, 'post').callsFake((opts) => {
      if (opts.url.indexOf(`/_vti_bin/client.svc/ProcessQuery`) > -1) {
        console.log(`Received: ${opts.body}`);

        const expectedBody = `<Request AddExpandoFieldTypeSuffix="true" SchemaVersion="15.0.0.0" LibraryVersion="16.0.0.0" ApplicationName=".NET Library" xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009"><Actions><ObjectPath Id="77" ObjectPathId="76" /><ObjectPath Id="79" ObjectPathId="78" /><Method Name="DeleteObject" Id="80" ObjectPathId="78" /><Method Name="Update" Id="81" ObjectPathId="24"><Parameters><Parameter Type="Boolean">true</Parameter></Parameters></Method></Actions><ObjectPaths><Property Id="76" ParentId="24" Name="FieldLinks" /><Method Id="78" ParentId="76" Name="GetById"><Parameters><Parameter Type="Guid">{${FIELD_LINK_ID}}</Parameter></Parameters></Method><Identity Id="24" Name="6b3ec69e-00a7-0000-55a3-61f8d779d2b3|740c6a0b-85e2-48a0-a494-e0f1759d4aa7:site:${SITE_ID}:web:${WEB_ID}:contenttype:${CONTENT_TYPE_ID}" /></ObjectPaths></Request>`;
        console.log(`Expected: ${expectedBody}`);

        if (opts.body === expectedBody) {
          return Promise.resolve(`[
              {
                "SchemaVersion": "15.0.0.0",
                "LibraryVersion": "16.0.7911.1206",
                "ErrorInfo": {
                  "ErrorMessage": "Unknown Error", "ErrorValue": null, "TraceCorrelationId": "b33c489e-009b-5000-8240-a8c28e5fd8b4", "ErrorCode": -1, "ErrorTypeName": "Microsoft.SharePoint.Client.UnknownError"
                },
                "TraceCorrelationId": "e5547d9e-705d-0000-22fb-8faca5696ed8"
              }
            ]`);
        }
      } 

      return Promise.reject(`Invalid request: ${opts.body}`);
    });


    auth.site = new Site();
    auth.site.connected = true;
    auth.site.url = WEB_URL;
    cmdInstance.action = command.action();
    cmdInstance.action({ options: { debug: true, webUrl: WEB_URL, contentTypeId: CONTENT_TYPE_ID, fieldLinkId: FIELD_LINK_ID, updateChildContentTypes: true } }, (err?: any) => {
      try {
        assert.equal(JSON.stringify(err), JSON.stringify(new CommandError('Unknown Error')));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });


  it('fails validation if contentTypeId is not passed', () => {
    const actual = (command.validate() as CommandValidate)({ options: { webUrl: WEB_URL, fieldLinkId: FIELD_LINK_ID } });
    assert.notEqual(actual, true);
  });
  it('fails validation if fieldLinkId is not passed', () => {
    const actual = (command.validate() as CommandValidate)({ options: { webUrl: WEB_URL, contentTypeId: CONTENT_TYPE_ID } });
    assert.notEqual(actual, true);
  });
  it('fails validation if webUrl is not passed', () => {
    const actual = (command.validate() as CommandValidate)({ options: { fieldLinkId: FIELD_LINK_ID, contentTypeId: CONTENT_TYPE_ID } });
    assert.notEqual(actual, true);
  });
  it('fails validation if fieldLinkId is not valid GUID', () => {
    const actual = (command.validate() as CommandValidate)({ options: { fieldLinkId: 'xxx', webUrl: WEB_URL, contentTypeId: CONTENT_TYPE_ID } });
    assert.notEqual(actual, true);
  });

  it('passes validation', () => {
    const actual = (command.validate() as CommandValidate)({ options: { fieldLinkId: FIELD_LINK_ID, contentTypeId: CONTENT_TYPE_ID, webUrl: WEB_URL, debug: true } });
    assert.equal(actual, true);
  });
  
  it('correctly handles lack of valid access token', (done) => {
    Utils.restore(auth.getAccessToken);
    sinon.stub(auth, 'getAccessToken').callsFake(() => { return Promise.reject(new Error('Error getting access token')); });
    auth.site = new Site();
    auth.site.connected = true;
    auth.site.url = WEB_URL;
    cmdInstance.action = command.action();
    cmdInstance.action({ options: { debug: true, webUrl: WEB_URL, contentTypeId: '0x0100FF0B2E33A3718B46A3909298D240FD93', fieldLinkId: '5ee2dd25-d941-455a-9bdb-7f2c54aed11b' } }, (err?: any) => {
      try {
        assert.equal(JSON.stringify(err), JSON.stringify(new CommandError('Error getting access token')));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });
});