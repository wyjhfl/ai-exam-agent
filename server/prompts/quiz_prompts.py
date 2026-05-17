QUIZ_GENERATION_PROMPT = """请生成 {count} 道考研{subject}题目，难度为{difficulty}。

要求：
1. 题目要符合考研真题风格
2. 包含4个选项（A/B/C/D）
3. 给出正确答案和详细解析
4. 标注考查的知识点

请以JSON格式返回，格式如下：
[
  {{
    "question": "题目内容",
    "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
    "answer": "正确答案",
    "explanation": "解析内容",
    "topic": "知识点"
  }}
]"""
