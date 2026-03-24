import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateDoc } from './create-doc';

describe('CreateDoc', () => {
  let component: CreateDoc;
  let fixture: ComponentFixture<CreateDoc>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateDoc]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateDoc);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
