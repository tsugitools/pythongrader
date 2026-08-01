#!/usr/bin/env python3
"""Generate PythonGrader assignment.json files from py4e pythonauto exercises3.php."""

from __future__ import annotations

import json
import re
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assignments"
SHARED = "assignments/_shared/files"

# Catalog key, slug path, title, pythonauto key, stdin for run/grade, asset filenames, notes
EXERCISES = [
    {
        "key": "Hello",
        "slug": "basics/hello",
        "title": "Hello World",
        "py4e": "hello",
        "stdin": "",
        "assets": [],
        "desired": "hello world",
        "desired2": None,
        "starter": '# the code below almost works\nprinq("hello world")\n',
        "solution": 'print("hello world")\n',
        "prompt": "Write a program that uses a <b>print</b> function to say 'hello world' as shown in Desired Output.",
        "checks": {"print": "You must use a print function."},
        "timeout_ms": 5000,
    },
    {
        "key": "Loop",
        "slug": "basics/loop",
        "title": "Loop with range",
        "py4e": "loop",
        "stdin": "",
        "assets": [],
        "desired": "0\n1\n2",
        "desired2": None,
        "starter": "print(range(3))\n",
        "solution": "for i in range(3):\n    print(i)\n",
        "prompt": "Write a program that uses a <b>for</b> loop and the built-in function <b>range</b> to write out three numbers as shown in Desired Output.",
        "checks": {
            "for": "You must produce the numbers using a for loop.",
            "print": "You must use a print function within the loop.",
            "range": "You should use the range function to generate the list of numbers on the for statement.",
            ":": "Your for statement should end with a colon (:) and the following line should be indented",
        },
        "timeout_ms": 5000,
    },
    {
        "key": "Exercise22",
        "slug": "basics/exercise-2-2",
        "title": "2.2 Welcome Name",
        "py4e": "2.2",
        "stdin": "Sarah\n",
        "assets": [],
        "desired": "Hello Sarah",
        "desired2": None,
        "starter": '# The code below almost works\n\nname = input("Enter your name")\nprint("Howdy")\n',
        "solution": 'name = input("Enter your name: ")\nprint("Hello", name)\n',
        "prompt": "<b>2.2</b> Write a program that uses <b>input</b> to prompt a user for their name and then welcomes them. The autograder will provide the name as input.",
        "checks": {
            "input": "You must prompt for the user's name using the input() function.",
            "!Sarah": "You must actually prompt for the user's name",
            "print": "You must use the print function to print the line of output.",
        },
        "timeout_ms": 5000,
    },
    {
        "key": "Exercise23",
        "slug": "basics/exercise-2-3",
        "title": "2.3 Gross Pay",
        "py4e": "2.3",
        "stdin": "35\n2.75\n",
        "assets": [],
        "desired": "Pay: 96.25",
        "desired2": None,
        "starter": '# This first line is provided for you\n\nhrs = input("Enter Hours:")\n',
        "solution": 'hrs = input("Enter Hours:")\nrate = input("Enter Rate:")\npay = float(hrs) * float(rate)\nprint("Pay:", pay)\n',
        "prompt": "<b>2.3</b> Write a program to prompt the user for hours and rate per hour using <b>input</b> to compute gross pay. Use <b>input</b> to read a string and <b>float()</b> to convert the string to a number. The autograder will provide the hours and rate as input (for the sample data, the pay should be 96.25).",
        "checks": {
            "input": "You must prompt the pay and rate using the input() function.",
            "print": "You must use the print function to print the output.",
            "float": "You should use the built-in float() function to convert from a string to a float.",
            "*": "To multiply the pay and rate after you read them use the '*' operator.",
            "!35": "You should not include the input data in your source code.",
            "!2.75": "You should not include the input data in your source code.",
            "!96.25": "You must actually calculate the pay.",
        },
        "timeout_ms": 5000,
    },
    {
        "key": "Exercise31",
        "slug": "conditionals/exercise-3-1",
        "title": "3.1 Overtime Pay",
        "py4e": "3.1",
        "stdin": "45\n10.50\n",
        "assets": [],
        "desired": "498.75",
        "desired2": "Pay: 498.75",
        "starter": 'hrs = input("Enter Hours:")\nh = float(hrs)\n',
        "solution": 'hrs = input("Enter Hours:")\nrate = input("Enter Rate:")\nh = float(hrs)\nr = float(rate)\nif h <= 40:\n    pay = h * r\nelse:\n    pay = 40 * r + (h - 40) * r * 1.5\nprint(pay)\n',
        "prompt": "<b>3.1</b> Write a program to prompt the user for hours and rate per hour using input to compute gross pay. Pay the hourly rate for the hours up to 40 and 1.5 times the hourly rate for all hours worked above 40 hours. The autograder will provide the hours and rate as input (for the sample data, the pay should be 498.75).",
        "checks": {
            "input": "You must prompt the pay and rate using the input() function.",
            "print": "You must use the print function to print the output.",
            "if": "You should use an if statement to decide to do the overtime computation or not.",
            "float": "You should use the built-in float() function to convert from a string to a float.",
            "!45": "You must read the hours using input() and then convert it.",
            "!10.5": "You must read the rate using input() and then convert it.",
            "!498": "You must actually calculate the pay.",
        },
        "timeout_ms": 5000,
    },
    {
        "key": "Exercise33",
        "slug": "conditionals/exercise-3-3",
        "title": "3.3 Score Grade",
        "py4e": "3.3",
        "stdin": "0.85\n",
        "assets": [],
        "desired": "B",
        "desired2": None,
        "starter": 'score = input("Enter Score: ")\n',
        "solution": 'score = input("Enter Score: ")\ntry:\n    score = float(score)\nexcept:\n    print("Bad score")\n    quit()\nif score < 0.0 or score > 1.0:\n    print("Bad score")\n    quit()\nif score >= 0.9:\n    print("A")\nelif score >= 0.8:\n    print("B")\nelif score >= 0.7:\n    print("C")\nelif score >= 0.6:\n    print("D")\nelse:\n    print("F")\n',
        "prompt": (
            "<b>3.3</b> Write a program to prompt for a score between 0.0 and 1.0. "
            "If the score is out of range, print an error. If the score is between 0.0 and 1.0, "
            "print a grade using the following table:<br/>"
            "Score&nbsp;&nbsp;&nbsp;&nbsp;Grade<br/>"
            "&gt;= 0.9&nbsp;&nbsp;&nbsp;&nbsp;A<br/>"
            "&gt;= 0.8&nbsp;&nbsp;&nbsp;&nbsp;B<br/>"
            "&gt;= 0.7&nbsp;&nbsp;&nbsp;&nbsp;C<br/>"
            "&gt;= 0.6&nbsp;&nbsp;&nbsp;&nbsp;D<br/>"
            "&lt; 0.6&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;F<br/>"
            "If the user enters a value out of range, print a suitable error message and exit. "
            "The autograder will provide the score as input (for the sample data, the grade should be B)."
        ),
        "checks": {
            "input": "You must prompt for the score using the input() function.",
            "float": "You should use the built-in float() function to convert from a string to a float.",
            "print": "You must use the print function to print the output.",
            "if": "You should use an if statement to check the value of the score.",
            "elif": "One of the learning objectives of this assignment is to use an elif statement when checking the value of the score.",
        },
        "timeout_ms": 5000,
    },
    {
        "key": "Exercise46",
        "slug": "functions/exercise-4-6",
        "title": "4.6 computepay()",
        "py4e": "4.6",
        "stdin": "",
        "assets": [],
        "desired": 498.75,  # unused for function grading; kept for docs
        "desired2": None,
        "starter": "def computepay(h, r):\n    return 42.37\n",
        "solution": (
            "def computepay(h, r):\n"
            "    if h <= 40:\n"
            "        return h * r\n"
            "    return 40 * r + (h - 40) * r * 1.5\n"
        ),
        "prompt": (
            "<b>4.6</b> Write a function called <b>computepay(h, r)</b> that computes gross pay. "
            "Pay the hourly rate for hours up to 40 and 1.5 times the hourly rate for all hours "
            "worked above 40. Return the pay from the function — do not prompt for input or print. "
            "The autograder will call your function with the test values "
            "(for 45 hours at a rate of 10.50, the pay should be 498.75)."
        ),
        "function_grade": {
            "name": "computepay",
            "cases": [
                {
                    "method": "test_overtime",
                    "title": "Overtime: 45 hours at 10.50",
                    "args": [45, 10.5],
                    "expected": 498.75,
                    "points": 10,
                    "feedback": "Pay 40 hours at the normal rate and the remaining hours at 1.5x.",
                },
                {
                    "method": "test_no_overtime",
                    "title": "No overtime: 40 hours at 10",
                    "args": [40, 10],
                    "expected": 400.0,
                    "points": 4,
                    "feedback": "When hours are 40 or less, return hours * rate.",
                },
            ],
        },
        "checks": {
            "def": "You must define a function called computepay.",
            "computepay": "You must use a function called computepay to do the computation.",
            "return": "You must use a return statement to return the computed pay.",
            "if": "You should use an if statement to decide the overtime computation or not.",
            "!input": "Do not prompt for input — only write the computepay function.",
            "!print": "Do not print — return the pay from computepay.",
            "!sum(": "Do not use a variable named sum or a function named sum()",
            "!498": "You must actually calculate the pay.",
        },
        "timeout_ms": 5000,
    },
    {
        "key": "Exercise52",
        "slug": "loops/exercise-5-2",
        "title": "5.2 Largest and Smallest",
        "py4e": "5.2",
        "stdin": "7\n2\nbob\n10\n4\ndone\n",
        "assets": [],
        "desired": "Invalid input\nMaximum is 10\nMinimum is 2",
        "desired2": None,
        "starter": 'largest = None\nsmallest = None\nwhile True:\n    num = input("Enter a number: ")\n    if num == "done":\n        break\n    print(num)\n\nprint("Maximum", largest)\n',
        "solution": 'largest = None\nsmallest = None\nwhile True:\n    num = input("Enter a number: ")\n    if num == "done":\n        break\n    try:\n        num = int(num)\n    except:\n        print("Invalid input")\n        continue\n    if largest is None or num > largest:\n        largest = num\n    if smallest is None or num < smallest:\n        smallest = num\n\nprint("Maximum is", largest)\nprint("Minimum is", smallest)\n',
        "prompt": "<b>5.2</b> Write a program that repeatedly prompts a user for integer numbers until the user enters 'done'. Once 'done' is entered, print out the largest and smallest of the numbers. If the user enters anything other than a valid number catch it with a try/except. The autograder will provide the sequence of inputs (including an invalid value and <code>done</code>); match the desired output.",
        "checks": {
            "input": "You must prompt for the numbers using the input() function.",
            "print": "You must use the print function to print the output.",
            "while": "You should use a while statement to read the numbers.",
            "int": "You should use the int() function to convert from a string to an integer.",
            "! 2": "You should actually compute the maximum and minimum.",
            "!=2": "You should actually compute the maximum and minimum.",
            "! 10": "You should actually compute the maximum and minimum.",
            "!=10": "You should actually compute the maximum and minimum.",
            "try": "You should handle bad numbers using a try/except structure.",
            "except": "You should handle bad numbers using a try/except structure.",
        },
        "timeout_ms": 5000,
    },
    {
        "key": "Exercise65",
        "slug": "strings/exercise-6-5",
        "title": "6.5 Extract Number",
        "py4e": "6.5",
        "stdin": "",
        "assets": [],
        "desired": "0.8475",
        "desired2": None,
        "starter": 'text = "X-DSPAM-Confidence:    0.8475"\n',
        "solution": 'text = "X-DSPAM-Confidence:    0.8475"\natpos = text.find(":")\npiece = text[atpos+1:]\nstripped = piece.strip()\nflt = float(stripped)\nprint(flt)\n',
        "prompt": "<b>6.5</b> Write code using find() and string slicing to extract the number at the end of the line below. Convert the extracted value to a floating point number and print it out.",
        "checks": {
            "find": "You should use the find function to get the position of the colon in the string.",
            ":": "You should use string slicing [n:m] to extract data from the string.",
            "float": "You should use the float() function to convert from a string to a float.",
            "!'0.8475'": "You must actually pull the data from the string.",
        },
        "timeout_ms": 5000,
    },
    {
        "key": "FileOpen",
        "slug": "files/file-open",
        "title": "Open and Count Lines",
        "py4e": "fopen",
        "stdin": "",
        "assets": ["mbox-short.txt"],
        "desired": "1910 Lines",
        "desired2": None,
        "starter": 'fh = open("mbox-short.txt", "r")\n\ncount = 0\nfor line in fh:\n   count = count + 1\n\nprint(count,"Lines")\n',
        "solution": 'fh = open("mbox-short.txt", "r")\n\ncount = 0\nfor line in fh:\n   count = count + 1\n\nprint(count,"Lines")\n',
        "prompt": 'This Python program opens the file "mbox-short.txt" and counts the number of lines in the file.',
        "checks": {
            "open": "You need to use open() to open the file.",
            "for": "You need a for loop to read the lines in the file.",
        },
        "timeout_ms": 10000,
        "allow_passing_starter": True,
    },
    {
        "key": "Exercise71",
        "slug": "files/exercise-7-1",
        "title": "7.1 File Uppercase",
        "py4e": "7.1",
        "stdin": "words.txt\n",
        "assets": ["words.txt"],
        "desired": None,  # filled dynamically from file
        "desired2": None,
        "starter": '# Use words.txt as the file name\nfname = input("Enter file name: ")\nfh = open(fname)\n',
        "solution": '# Use words.txt as the file name\nfname = input("Enter file name: ")\nfh = open(fname)\ntext = fh.read().strip()\nprint(text.upper())\n',
        "prompt": '<b>7.1</b> Write a program that prompts for a file name, then opens that file and reads through the file, and print the contents of the file in upper case. The autograder will provide the file name <b>words.txt</b> as input.',
        "checks": {
            "input": "You must prompt for the file name using the input() function.",
            "open": "You need to use open() to open the file.",
            "print": "You must use the print function to print the lines.",
            "strip": "You should use strip() or rstrip() to avoid double newlines.",
            "upper": "You should use the upper() function to convert the lines to upper case.",
        },
        "timeout_ms": 10000,
    },
    {
        "key": "Exercise72",
        "slug": "files/exercise-7-2",
        "title": "7.2 Spam Confidence",
        "py4e": "7.2",
        "stdin": "mbox-short.txt\n",
        "assets": ["mbox-short.txt"],
        "desired": "Average spam confidence: 0.7507185185185187",
        "desired2": None,
        "starter": '# Use the file name mbox-short.txt as the file name\nfname = input("Enter file name: ")\nfh = open(fname)\nfor line in fh:\n    if not line.startswith("X-DSPAM-Confidence:"):\n        continue\n    print(line)\nprint("Done")\n',
        "solution": '# Use the file name mbox-short.txt as the file name\nfname = input("Enter file name: ")\nfh = open(fname)\ntot = 0.0\ncount = 0\nfor line in fh:\n    if not line.startswith("X-DSPAM-Confidence:") : continue\n    words = line.split()\n    tot = tot + float(words[1])\n    count = count + 1\nprint("Average spam confidence:", tot/count)\n',
        "prompt": "<b>7.2</b> Write a program that prompts for a file name, then opens that file and reads through the file, looking for lines of the form X-DSPAM-Confidence: 0.8475. Count these lines and compute the average. Do not use the sum() function. The autograder will provide the file name <b>mbox-short.txt</b> as input.",
        "checks": {
            "input": "You must prompt for the file name using the input() function.",
            "open": "You need to use open() to open the file.",
            "!sum": "You should not use the sum() function and avoid using sum as a variable.",
            "float": "You should use the float() function to convert from a string to a float.",
            "!18518": "You must actually pull the data from the strings and convert it.",
            "/": "Average is usually a total / count.",
        },
        "timeout_ms": 10000,
    },
    {
        "key": "Exercise84",
        "slug": "lists/exercise-8-4",
        "title": "8.4 Unique Words",
        "py4e": "8.4",
        "stdin": "romeo.txt\n",
        "assets": ["romeo.txt"],
        "desired": "['Arise', 'But', 'It', 'Juliet', 'Who', 'already', 'and', 'breaks', 'east', 'envious', 'fair', 'grief', 'is', 'kill', 'light', 'moon', 'pale', 'sick', 'soft', 'sun', 'the', 'through', 'what', 'window', 'with', 'yonder']",
        "desired2": None,
        "starter": "fname = input(\"Enter file name: \")\nfh = open(fname)\nlst = list()\nfor line in fh:\nprint(line.rstrip())\n",
        "solution": "fname = input(\"Enter file name: \")\nfh = open(fname)\nlst = list()\nfor line in fh:\n    words = line.split()\n    for word in words:\n        if word in lst: continue\n        lst.append(word)\nlst.sort()\nprint(lst)\n",
        "prompt": "<b>8.4</b> Prompt for a file name (the autograder will provide <b>romeo.txt</b>), open that file, and read it line by line. For each line, split the line into a list of words. Build a list of unique words, then sort and print the resulting words.",
        "checks": {
            "split": "You should use split() to break each line into words.",
            "append": "You should use append() to add the word to the list if it is not there.",
            "!extend": "You should not use extend() in this assignment.",
            "open": "You need to use open() to open the file.",
            "sort": "You need to use sort() to sort the list before you print it out.",
            "!'yonder'": "You should not put the output data in strings",
            "!.remove(": "You should not need to use the remove() method",
            "!.set(": "You should not need to use the set() method",
            "for": "You need two for loops. One for the lines and one for the words on each line.",
        },
        "timeout_ms": 10000,
    },
    {
        "key": "Exercise85",
        "slug": "lists/exercise-8-5",
        "title": "8.5 From Addresses",
        "py4e": "8.5",
        "stdin": "mbox-short.txt\n",
        "assets": ["mbox-short.txt"],
        "desired": None,  # long - compute
        "desired2": None,
        "starter": 'fname = input("Enter file name: ")\nif len(fname) < 1:\n    fname = "mbox-short.txt"\n\nfh = open(fname)\ncount = 0\n\nprint("There were", count, "lines in the file with From as the first word")\n',
        "solution": 'fname = input("Enter file name: ")\nif len(fname) < 1 : fname = "mbox-short.txt"\n\nfh = open(fname)\ncount = 0\nfor line in fh:\n    wds = line.split()\n    if len(wds) < 2 : continue\n    if wds[0] != "From" : continue\n    print(wds[1])\n    count = count + 1\nprint("There were", count, "lines in the file with From as the first word")\n',
        "prompt": "<b>8.5</b> Prompt for a file name (the autograder will provide <b>mbox-short.txt</b>), open that file, and read it line by line. When you find a line that starts with 'From ' parse it with split() and print the second word (email address). Then print a count at the end.",
        "checks": {
            "for": "You need a for loop to read the lines in the file.",
            "split": "You should use split() to break each line into words.",
            "if": "You need to use one or more if statements to skip the lines that do not start with 'From '.",
            "open": "You need to use open() to open the file.",
        },
        "timeout_ms": 10000,
    },
    {
        "key": "Exercise94",
        "slug": "dictionaries/exercise-9-4",
        "title": "9.4 Most Prolific Sender",
        "py4e": "9.4",
        "stdin": "mbox-short.txt\n",
        "assets": ["mbox-short.txt"],
        "desired": "cwen@iupui.edu 5",
        "desired2": None,
        "starter": 'name = input("Enter file:")\nif len(name) < 1:\n    name = "mbox-short.txt"\nhandle = open(name)\n',
        "solution": 'name = input("Enter file:")\nif len(name) < 1 : name = "mbox-short.txt"\nhandle = open(name)\ncounts = dict()\nfor line in handle:\n    wds = line.split()\n    if len(wds) < 2 : continue\n    if wds[0] != "From" : continue\n    email = wds[1]\n    counts[email] = counts.get(email,0) + 1\n\nbigcount = None\nbigname = None\nfor name,count in counts.items():\n    if bigname is None or count > bigcount:\n        bigname = name\n        bigcount = count\n\nprint(bigname, bigcount)\n',
        "prompt": "<b>9.4</b> Write a program that prompts for a file name (the autograder will provide <b>mbox-short.txt</b>), reads the file, and figures out who has sent the greatest number of mail messages. Build a dictionary of counts and find the most prolific sender.",
        "checks": {
            "for": "You need a for loop to read the lines in the file.",
            "split": "You should use split() to break each line into words.",
            "!cwen@iupui.edu": "You need a for loop to read the data in the file.",
            "if": "You need to use one or more if statements to skip the lines that do not start with 'From '.",
            "open": "You need to use open() to open the file.",
        },
        "timeout_ms": 10000,
    },
    {
        "key": "Exercise102",
        "slug": "tuples/exercise-10-2",
        "title": "10.2 Hour Distribution",
        "py4e": "10.2",
        "stdin": "",
        "assets": ["mbox-short.txt"],
        "desired": "04 3\n06 1\n07 1\n09 2\n10 3\n11 6\n14 1\n15 2\n16 4\n17 2\n18 1\n19 1",
        "desired2": None,
        "starter": 'handle = open("mbox-short.txt")\n',
        "solution": (
            'handle = open("mbox-short.txt")\n'
            "counts = dict()\n"
            "for line in handle:\n"
            "    wds = line.split()\n"
            "    if len(wds) < 6 : continue\n"
            '    if wds[0] != "From" : continue\n'
            "    when = wds[5]\n"
            '    tics = when.split(":")\n'
            "    if len(tics) != 3 : continue\n"
            "    hour = tics[0]\n"
            "    counts[hour] = counts.get(hour,0) + 1\n"
            "\n"
            "for key, val in sorted(counts.items()):\n"
            "    print(key, val)\n"
        ),
        "prompt": (
            "<b>10.2</b> Write a program that opens the file <b>mbox-short.txt</b> "
            "(hard-code that file name — do not prompt for it) and figures out the "
            "distribution by hour of the day for each of the messages. Pull the hour "
            "from the 'From ' line, count by hour, and print counts sorted by hour."
        ),
        "checks": {
            "open": "You need to use open() to open the file.",
            "mbox-short.txt": "Hard-code the file name mbox-short.txt — do not prompt for it.",
            "!input": "Do not prompt for the file name — open mbox-short.txt directly.",
            "for": "You need a for loop to read the lines in the file.",
            "sort": "You need to use a sort (list sort() or sorted()) to order the hours.",
        },
        "timeout_ms": 10000,
    },
    {
        "key": "Exercise111",
        "slug": "regex/exercise-11-1",
        "title": "11.1 Answer to Life, the Universe and Everything",
        "py4e": "11.1",
        "stdin": "",
        "assets": [],
        "desired": "42",
        "desired2": None,
        "starter": "# Print the answer — but it must be computed, not hard-coded\n",
        "solution": "print(6 * 7)\n",
        "prompt": "<b>11.1</b> Write a program that computes the <b>Answer to the Ultimate Question of Life, the Universe, and Everything</b>. Sample output is below.",
        "checks": {
            "print": "By now you should know that a print function would be helpful here.",
            "*": "I think that multiplication is involved...",
            "!42": "Do not hard-code 42 — compute the answer.",
        },
        "timeout_ms": 5000,
    },
    {
        "key": "Exercise119",
        "slug": "regex/exercise-11-9",
        "title": "11.9 Regex Line Count",
        "py4e": "11.9",
        "stdin": "",
        "assets": ["mbox-short.txt"],
        "desired": "mbox-short.txt had 27 lines that matched ^From ",
        "desired2": None,
        "starter": 'import re\n\nstring = "^From "\nhandle = open("mbox-short.txt")\ncount = 0\nfor line in handle:\n    if re.search(string) : count = count + 1\nprint("mbox-short.txt had ", count, "lines that matched", string)\n',
        "solution": 'import re\n\nstring = "^From "\nhandle = open("mbox-short.txt")\ncount = 0\nfor line in handle:\n    line = line.rstrip()\n    if re.search(string, line):\n        count = count + 1\nprint("mbox-short.txt had", count, "lines that matched", string)\n',
        "prompt": "<b>11.9</b> Write a program that reads through <b>mbox-short.txt</b> and counts how many lines match the regular expression <code>^From </code> using <b>re.search()</b>. Hard-code that pattern in your program (do not prompt for it). When you run the program, the output should be: <code>mbox-short.txt had 27 lines that matched ^From </code>.",
        "checks": {
            "for": "You need a for loop to read the lines in the file.",
            "re.search": "You need to use re.search() to match the regular expression.",
            "import re": "You need to import the re module.",
            "^From ": "Hard-code the regular expression ^From  in your program.",
        },
        "timeout_ms": 10000,
    },
]

# Udemy Plan-exercise "learning objective" text (plain string, pasteable).
LEARNING_OBJECTIVES = {
    "Hello": (
        "Use Python's print() function to display a simple greeting string."
    ),
    "Loop": (
        "Use a for loop with range() to print a short sequence of integers."
    ),
    "Exercise22": (
        "Read a name with input() and print a personalized Hello greeting."
    ),
    "Exercise23": (
        "Convert input strings to numbers with float() and compute gross pay."
    ),
    "Exercise31": (
        "Use if/else to pay overtime (1.5x) for hours worked above 40."
    ),
    "Exercise33": (
        "Map a numeric score to a letter grade using if/elif/else. "
        "There is only one score — the solution does not need a loop."
    ),
    "Exercise46": (
        "Write a computepay(h, r) function that returns gross pay with overtime."
    ),
    "Exercise52": (
        "Loop until a sentinel value, track min and max, and catch invalid input with try/except."
    ),
    "Exercise65": (
        "Extract a number from a string with find() and slicing, then convert it with float()."
    ),
    "FileOpen": (
        "Open a text file and count its lines using a for loop."
    ),
    "Exercise71": (
        "Open a user-chosen file and print its entire contents in uppercase."
    ),
    "Exercise72": (
        "Scan a mailbox file for confidence lines and compute their average without sum()."
    ),
    "Exercise84": (
        "Build a sorted list of unique words from a text file using split() and append()."
    ),
    "Exercise85": (
        "Parse email addresses from mailbox From lines and print a final count."
    ),
    "Exercise94": (
        "Use a dictionary to count senders and find the most prolific email address."
    ),
    "Exercise102": (
        "Count messages by hour of day and print the distribution sorted by hour."
    ),
    "Exercise111": (
        "Compute and print the Answer to Life, the Universe, and Everything "
        "(from The Hitchhiker's Guide to the Galaxy)."
    ),
    "Exercise119": (
        "Count lines in a mailbox file that match a regular expression with re.search()."
    ),
}

# Udemy learner-facing Hint field (one short nudge; not the full solution).
HINTS = {
    "Hello": (
        "Look carefully at the starter: print is misspelled. Fix the function name and keep the quoted string."
    ),
    "Loop": (
        "range(3) is not a list of printed lines — loop over it with for and print each value."
    ),
    "Exercise22": (
        "Call input() to get the name, then print('Hello', name) so the entered name appears in the greeting."
    ),
    "Exercise23": (
        "Read hours and rate with input(), convert both with float(), multiply, then print Pay: and the result."
    ),
    "Exercise31": (
        "If hours are over 40, pay the first 40 at the normal rate and the rest at 1.5 times the rate."
    ),
    "Exercise33": (
        "Convert the score with float(), reject values outside 0.0–1.0, then use if/elif for A–F thresholds."
    ),
    "Exercise46": (
        "Only write def computepay(h, r): — if hours are over 40, pay the extra hours at 1.5x and return the total."
    ),
    "Exercise52": (
        "Keep looping until the user types done. Use try/except around int(), and update largest/smallest as you go."
    ),
    "Exercise65": (
        "Find the colon with find(':'), slice after it, strip spaces, then float() and print the number."
    ),
    "FileOpen": (
        "open() the file, count each line in a for loop, then print the count and the word Lines."
    ),
    "Exercise71": (
        "After opening the file, read the text, call .upper(), and print it (strip trailing newlines if needed)."
    ),
    "Exercise72": (
        "Skip lines that do not start with X-DSPAM-Confidence:, float the second word, and average total/count."
    ),
    "Exercise84": (
        "Split each line into words; append a word only if it is not already in the list; sort before printing."
    ),
    "Exercise85": (
        "For lines whose first word is From, print the second word (the email) and count those lines."
    ),
    "Exercise94": (
        "Count From addresses in a dictionary, then loop through items to find the email with the highest count."
    ),
    "Exercise102": (
        "Open mbox-short.txt directly (no input). From each From line, split the time on ':', "
        "count by hour, then print sorted(hour, count)."
    ),
    "Exercise111": (
        "In The Hitchhiker's Guide to the Galaxy, the Answer is 6 * 7 — compute and print that product."
    ),
    "Exercise119": (
        "import re, open mbox-short.txt, and use re.search(r'^From ', line) inside your counting loop."
    ),
}

# Udemy Solution explanation (shown after the learner finishes / reveals the solution).
SOLUTION_EXPLANATIONS = {
    "Hello": (
        "The fix is a one-character typo: rename prinq to print so Python calls the built-in "
        "print function with the string hello world."
    ),
    "Loop": (
        "range(3) produces the values 0, 1, and 2. A for loop visits each value and print "
        "writes it on its own line."
    ),
    "Exercise22": (
        "input() reads the name as a string. Passing that string to print with Hello "
        "builds the welcome line without hard-coding the person's name."
    ),
    "Exercise23": (
        "Hours and rate arrive as strings from input(). float() converts them so you can "
        "multiply, then print labels the result as Pay:."
    ),
    "Exercise31": (
        "Regular hours are paid at the hourly rate. Hours above 40 are paid at 1.5 times "
        "the rate; an if/else chooses which formula to use."
    ),
    "Exercise33": (
        "After converting the score to a float and checking the 0.0–1.0 range, chained "
        "if/elif/else tests pick the matching letter grade from high to low."
    ),
    "Exercise46": (
        "computepay(h, r) returns the pay. Hours up to 40 use the normal rate; hours above "
        "40 use 1.5 times the rate. The autograder calls the function — no input() or print() needed."
    ),
    "Exercise52": (
        "A while loop reads numbers until done. try/except skips bad input, and you "
        "update running largest and smallest values before printing both."
    ),
    "Exercise65": (
        "find(':') locates the separator. Slicing after that position, stripping spaces, "
        "and calling float() yields the confidence number to print."
    ),
    "FileOpen": (
        "open() gives a file handle. Each iteration of for line in fh: is one line; "
        "increment a counter and print the total with Lines."
    ),
    "Exercise71": (
        "Prompt for the file name, open it, read the text, convert with upper(), and "
        "print so every character appears in uppercase."
    ),
    "Exercise72": (
        "Only X-DSPAM-Confidence: lines contribute. Convert the numeric token with float(), "
        "accumulate a total and count, then print total/count as the average."
    ),
    "Exercise84": (
        "split() breaks each line into words. Append a word only when it is new, then "
        "sort() the list so the unique vocabulary prints in order."
    ),
    "Exercise85": (
        "Lines that begin with From have the email in the second column. Print each "
        "address and keep a count for the final summary line."
    ),
    "Exercise94": (
        "A dictionary maps each From address to how often it appears. After counting, "
        "scan the items to find the address with the largest count."
    ),
    "Exercise102": (
        "Open mbox-short.txt with a hard-coded name. The time token on a From line splits "
        "into hour:minute:second. Count by hour in a dictionary, then print sorted hours and counts."
    ),
    "Exercise111": (
        "The joke answer from The Hitchhiker's Guide is 42, which is just 6 * 7 printed."
    ),
    "Exercise119": (
        "re.search(r'^From ', line) is true when a line starts with From followed by a "
        "space. Counting those matches reports how many such lines the file contains."
    ),
}


_SYMBOL_NAMES = {
    ":": "colon",
    "*": "star",
    "/": "slash",
    "=": "equals",
}


def check_method_name(needle: str) -> str:
    if needle in _SYMBOL_NAMES:
        safe = _SYMBOL_NAMES[needle]
    else:
        safe = re.sub(r"[^A-Za-z0-9]+", "_", needle).strip("_")
        if not safe:
            safe = "token"
        if safe[0].isdigit():
            safe = "n_" + safe
    return "test_source_" + safe[:40]


STUDENT_FILE_HELPER = '''
def student_file():
    """PythonGrader uses student.py; Udemy coding exercises use exercise.py."""
    for name in ('student.py', 'exercise.py'):
        if os.path.isfile(name):
            return name
    return 'student.py'
'''.lstrip()


def _build_source_checks(checks: dict, per_check: int) -> tuple[str, dict, list[str]]:
    """Return SourceTests class source, metadata, and method bodies list."""
    check_methods = []
    meta = {}
    for needle, feedback in checks.items():
        forbidden = needle.startswith("!")
        token = needle[1:] if forbidden else needle
        method = check_method_name(("not_" if forbidden else "") + token)
        base = method
        i = 2
        while any(m.startswith(f"    def {method}(") for m in check_methods):
            method = f"{base}_{i}"
            i += 1
        if forbidden:
            body = (
                f"    def {method}(self):\n"
                f"        self.assertNotIn({json.dumps(token)}, self.src,\n"
                f"            {json.dumps(feedback)})\n"
            )
        else:
            body = (
                f"    def {method}(self):\n"
                f"        self.assertIn({json.dumps(token)}, self.src,\n"
                f"            {json.dumps(feedback)})\n"
            )
        check_methods.append(body)
        meta[f"SourceTests.{method}"] = {
            "title": f"Source check: {'forbid' if forbidden else 'require'} {token!r}",
            "group": "Source requirements",
            "points": per_check,
            "feedback": feedback,
        }

    source_class = ""
    if check_methods:
        source_class = (
            "class SourceTests(unittest.TestCase):\n"
            "    @classmethod\n"
            "    def setUpClass(cls):\n"
            "        with open(student_file(), encoding='utf-8') as f:\n"
            "            cls.src = f.read()\n"
            "\n" + "\n".join(check_methods)
        )
    return source_class, meta, check_methods


def build_function_evaluation(ex: dict) -> tuple[str, dict, int]:
    """Grade by importing student code and calling a named function."""
    fg = ex["function_grade"]
    fname = fg["name"]
    cases = fg["cases"]
    checks = ex.get("checks") or {}
    n_checks = len(checks)
    per_check = 1 if n_checks else 0

    meta = {}
    case_methods = []
    case_points = 0
    for case in cases:
        method = case["method"]
        args_repr = ", ".join(repr(a) for a in case["args"])
        expected = case["expected"]
        points = case.get("points", 5)
        case_points += points
        case_methods.append(
            f"    def {method}(self):\n"
            # Call via module attribute so Python does not bind self as first arg.
            f"        got = self.mod.{fname}({args_repr})\n"
            f"        self.assertAlmostEqual(got, {repr(expected)}, places=4,\n"
            f"            msg={json.dumps(case.get('feedback') or 'Unexpected return value.')})\n"
        )
        meta[f"FunctionTests.{method}"] = {
            "title": case.get("title") or method,
            "group": "Function",
            "points": points,
            "feedback": case.get("feedback") or "Check the return value of your function.",
        }

    source_class, source_meta, _ = _build_source_checks(checks, per_check)
    meta.update(source_meta)
    maximum = case_points + per_check * n_checks

    evaluation = f'''import importlib.util
import os
import unittest

{STUDENT_FILE_HELPER}

def load_student():
    path = student_file()
    spec = importlib.util.spec_from_file_location("_student_under_test", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load student file: " + path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class FunctionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_student()
        if not hasattr(cls.mod, {json.dumps(fname)}):
            raise AssertionError({json.dumps(f"Define a function named {fname}(h, r).")})

{"".join(case_methods)}

{source_class}
'''
    return evaluation, meta, maximum


def build_evaluation(ex: dict) -> tuple[str, dict, int]:
    if ex.get("function_grade"):
        return build_function_evaluation(ex)

    desired = ex["desired"]
    desired2 = ex.get("desired2")
    stdin = ex["stdin"]
    checks = ex.get("checks") or {}

    # Output test + one test per source check
    n_checks = len(checks)
    if n_checks == 0:
        output_points = 10
        per_check = 0
    else:
        # Prefer output-heavy scoring like classic autograder (all-or-nothing feel with partial)
        if n_checks <= 3:
            output_points = 10 - n_checks
            per_check = 1
        else:
            # Better: all checks worth 1, output worth 10, maximum = 10 + n_checks
            output_points = 10
            per_check = 1

    maximum = output_points + per_check * n_checks

    desired_repr = json.dumps(desired)
    desired2_repr = json.dumps(desired2) if desired2 else "None"
    stdin_repr = json.dumps(stdin)

    source_class, source_meta, _ = _build_source_checks(checks, per_check)
    meta = {
        "OutputTests.test_desired_output": {
            "title": "Matches desired output",
            "group": "Output",
            "points": output_points,
            "feedback": "Compare your program output carefully to the Desired Output.",
        }
    }
    meta.update(source_meta)

    evaluation = f'''import io
import os
import runpy
import sys
import unittest
from unittest.mock import patch

DESIRED = {desired_repr}
DESIRED2 = {desired2_repr}
STDIN = {stdin_repr}


{STUDENT_FILE_HELPER}

def run_student(stdin=STDIN):
    output = io.StringIO()
    with patch('builtins.input', side_effect=_input_side_effect(stdin)):
        with patch('sys.stdout', output):
            try:
                runpy.run_path(student_file(), run_name='__main__')
            except SystemExit:
                pass
    return output.getvalue()


def _input_side_effect(stdin):
    lines = stdin.splitlines()
    # Preserve trailing blank semantics for programs that call input() once per line
    if stdin.endswith('\\n'):
        # splitlines drops final empty; reconstruct queue of lines without newlines
        pass
    queue = list(lines)

    def _input(prompt=''):
        if not queue:
            raise EOFError('EOF when reading a line')
        return queue.pop(0)

    return _input


class OutputTests(unittest.TestCase):
    def test_desired_output(self):
        got = run_student().rstrip()
        # Normalize trailing whitespace per line for friendlier comparison
        got_norm = '\\n'.join(line.rstrip() for line in got.splitlines()).rstrip()
        want = DESIRED.rstrip() if isinstance(DESIRED, str) else DESIRED
        alts = [want]
        if DESIRED2:
            alts.append(DESIRED2.rstrip())
        if got_norm not in alts:
            self.assertEqual(got_norm, want)


{source_class}
'''
    return evaluation, meta, maximum


def compute_desired_71():
    text = (ROOT / SHARED / "words.txt").read_text().strip().upper()
    return text


def compute_desired_85():
    emails = []
    for line in (ROOT / SHARED / "mbox-short.txt").open():
        wds = line.split()
        if len(wds) < 2 or wds[0] != "From":
            continue
        emails.append(wds[1])
    body = "\n".join(emails)
    return body + f"\nThere were {len(emails)} lines in the file with From as the first word"


def main():
    # Fill dynamic desired outputs
    for ex in EXERCISES:
        if ex["key"] == "Exercise71":
            ex["desired"] = compute_desired_71()
        if ex["key"] == "Exercise85":
            ex["desired"] = compute_desired_85()

    catalog = {}
    path_map = {}

    # Keep existing HelloName in catalog
    catalog["HelloName"] = "Basics: Hello, Name"
    path_map["HelloName"] = "assignments/basics/hello-name"

    for ex in EXERCISES:
        evaluation, meta, maximum = build_evaluation(ex)
        assets = [
            {
                "source": f"{SHARED}/{name}",
                "mount": name,
                "required": True,
            }
            for name in ex["assets"]
        ]
        objective = ex.get("learning_objective") or LEARNING_OBJECTIVES.get(ex["key"])
        hint = ex.get("hint") or HINTS.get(ex["key"])
        explanation = (
            ex.get("solution_explanation")
            or SOLUTION_EXPLANATIONS.get(ex["key"])
        )
        assignment = {
            "type": "pythongrader",
            "schema_version": 1,
            "id": ex["slug"].replace("/", "-") + "-001",
            "assignment_version": 1,
            "title": ex["title"],
            "prompt": f"<p>{ex['prompt']}</p>",
            "learning_objective": objective,
            "hint": hint,
            "solution_explanation": explanation,
            "files": {
                "student.py": {
                    "mode": "editable",
                    "starter": ex["starter"],
                    "solution": ex["solution"],
                }
            },
            "run": {
                "stdin": ex["stdin"],
                "timeout_ms": ex["timeout_ms"],
            },
            "evaluation": {
                "filename": "evaluation.py",
                "source": evaluation,
                "tests": meta,
            },
            "assets": assets,
            "packages": [],
            "grading": {
                "maximum_points": maximum,
                "partial_credit": True,
            },
            "exports": {"udemy": {"enabled": True}},
            "py4e_exercise": ex["py4e"],
        }
        if not objective:
            print(f"WARNING: missing learning_objective for {ex['key']}")
        if not hint:
            print(f"WARNING: missing hint for {ex['key']}")
        if not explanation:
            print(f"WARNING: missing solution_explanation for {ex['key']}")
        if ex.get("allow_passing_starter"):
            assignment["authoring"] = {"allow_passing_starter": True}

        dest = OUT / ex["slug"]
        dest.mkdir(parents=True, exist_ok=True)
        (dest / "assignment.json").write_text(
            json.dumps(assignment, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        catalog[ex["key"]] = ex["title"] if not ex["title"][0].isdigit() else ex["title"]
        # Prefer py4e-style labels
        catalog[ex["key"]] = f"PY4E: {ex['title']}"
        path_map[ex["key"]] = f"assignments/{ex['slug']}"
        print(f"wrote {dest / 'assignment.json'} ({maximum} pts, {len(meta)} tests)")

    # Write catalog snippet for assignments.php
    cat_lines = ["    return array("]
    for k, label in catalog.items():
        cat_lines.append(f"        '{k}' => '{label}',")
    cat_lines.append("    );")
    map_lines = ["    $map = array("]
    for k, rel in path_map.items():
        map_lines.append(f"        '{k}' => '{rel}',")
    map_lines.append("    );")
    snippet = OUT / "_catalog_generated.php.txt"
    snippet.write_text(
        "\n".join(cat_lines) + "\n\n" + "\n".join(map_lines) + "\n",
        encoding="utf-8",
    )
    print(f"catalog snippet -> {snippet}")


if __name__ == "__main__":
    main()
