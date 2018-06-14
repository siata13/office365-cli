import * as assert from 'assert';
import { Finding } from '../Finding';
import { Project } from '../model';
import { FN005001_CFG_DAS_schema } from './FN005001_CFG_DAS_schema';

describe('FN005001_CFG_DAS_schema', () => {
  let findings: Finding[];
  let rule: FN005001_CFG_DAS_schema;

  beforeEach(() => {
    findings = [];
    rule = new FN005001_CFG_DAS_schema('test-schema');
  })

  it('doesn\'t return notification if schema is already up-to-date', () => {
    const project: Project = {
      path: '/usr/tmp',
      deployAzureStorageJson: {
        $schema: 'test-schema'
      }
    };
    rule.visit(project, findings);
    assert.equal(findings.length, 0);
  });
});