# Session 4: Practical Work

**Doctor Mo:**  
> Hey team! We really like the Learning Management System you've built so far, but we want to make it much smarter and more exciting than a normal system like Canvas. We've been hearing a lot about AI and Machine Learning, and we're wondering what cool features you could add. For example, we have student information like attendance, quiz results and assignments. Could AI help us predict which students might struggle or need extra support? Could we have an intelligent chatbot that students can ask questions about their courses, assignments and learning materials? Maybe the system could even recommend what students should study next based on their performance. We're open to your ideas too! We don't know exactly how these technologies work, so we'd like your team to investigate what's possible and show us a working prototype. We can provide some sample student data to get you started. Can you surprise us with something useful?

---

## Task 1: Explore Student Data

**Objective:** Understand the student dataset before building a Machine Learning model.

### Instructions
1. Download the file `students_demo.csv`
2. Open the file in Excel or VS Code.
3. Look at the information about the students.
4. Find these columns:
   - `attendance_pct`
   - `quiz_average`
   - `missed_assignments`
   - `weekly_logins`
   - `days_since_login`
   - `at_risk`

### Questions
1. How many students are in the dataset?
2. What information do we have about each student?
3. Which column tells us whether a student is at risk?
4. How could we use this information in our Canvas-like system?

### Expected Outcome
You can explain what information is available in the dataset and what we want our Machine Learning model to predict.

*Resource:* [students_demo (1).csv](https://asahe.instructure.com/courses/999/files/252663?wrap=1) ([Download](https://asahe.instructure.com/courses/999/files/252663/download?download_frd=1))

---

## Task 2: Build Your First Machine Learning Model

**Objective:** Train a Machine Learning model using student data to predict whether a student may be at risk.

### Instructions
1. Open your existing LMS project in VS Code.
2. Make sure `students_demo.csv` is available in your project.
3. Using the `students_demo.csv` file, help me build a simple Machine Learning model using Python and Decision Tree Classification.
4. The model should learn from student attendance, quiz results, missed assignments, weekly logins and days since last login.
5. Use `at_risk` as the target column.
6. Divide the data into 80% training and 20% testing.
7. Train the model and display its accuracy.
8. Save the trained model so we can use it later in your application.
10. Explain the code in simple English.

### Test Your Model
1. Run the Python program.
2. Check whether the model was trained successfully.
3. Find the accuracy score.
4. Test the model using one new fictional student.

### Questions
1. What is the name of the Machine Learning algorithm?
2. What does training a model mean?
3. What is the difference between training data and testing data?
4. What accuracy did your model achieve?

### Expected Outcome
You have trained and saved your first Machine Learning model using student data. You can explain what the model predicts and how its accuracy was measured.