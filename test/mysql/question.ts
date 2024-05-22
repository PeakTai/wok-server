import { Table } from '../../src'

export interface QuesOption {
  title: string
  correct?: boolean
}

export interface QuestionSetter {
  id: string
  name: string
}

export interface Question {
  id: string
  title: string
  options: QuesOption[]
  question_setter: QuestionSetter
  create_at?: number
  update_at?: number
}

export const tableQuestion: Table<Question> = {
  tableName: 'question',
  id: 'id',
  columns: ['title', 'options', 'question_setter'],
  createdDate: {
    type: 'number',
    column: 'create_at'
  },
  updatedDate: {
    type: 'number',
    column: 'update_at'
  }
}
