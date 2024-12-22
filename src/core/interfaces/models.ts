export enum SecurityQuestions {
  MOTHER_MAIDEN_NAME = "What is your mother's maiden name?",
  NAME_OF_FIRST_PET = 'What is the name of your first pet?',
  NAME_OF_CITY_YOU_WERE_BORN_IN = 'What is the name of the city where you were born?',
  NAME_OF_YOUR_PRIMARY_SCHOOL = 'What is the name of your primary school?'
}

export interface User {
  username: string;
  security_q: SecurityQuestions;
  security_a: string;
}
