import json
from operator import add

path = r"C:\Users\Matej\Downloads\instances\results_real\final"

correctALL = 0
correctIDf_ALL = [0] * 6
correctIDm_ALL = [0] * 6
correctR_ALL = [0] * 4

text = ""

def ro(a, d):
    return "%.2f" % (a / d)

firstAll = 0
first = 0

for j in range(20):
    filepath = fr'\data{j}.json'
    # filepath = r'\testJSON'
    # if j == 0:
    #     filepath += ".json"
    # else:
    #     filepath += f" ({j}).json"

    with open(path + filepath, 'r', encoding="utf-8") as f:
        data = json.load(f)

    save = []
    data2 = data['results']
    total = 0
    correct = 0
    correctIDf = [0] * 6
    correctIDm = [0] * 6
    correctR = [0] * 4
    for i in data2:
        id = i['id']
        renderer = i['renderer']
        # if id == 1:
        #     i['correct'] = not i['correct']
        save.append(i)
            #print(i['correct'])
        
        if total == 0 and renderer == 4:
            firstAll += 1
            if i['correct']:
                first += 1 

        if i['correct']:
            if renderer == 4:
                correctR[0]+=1
            if renderer == 3:
                correctR[1]+=1
            if renderer == 2:
                correctR[2]+=1
            if renderer == 5:
                correctR[3]+=1
            if id < 6:
                correctIDf[id]+=1
            else:
                correctIDm[id-10]+=1
            correct+=1
        total+=1

    # print(j)
    # print(correctIDf)
    # print(correctIDm)
    t = ro(correctR[0], 12) + ', ' + ro(correctR[1], 12) + ', ' + ro(correctR[2], 12) + ', ' + ro(correctR[3], 12) + ', ' + ro(correct, 48) + "\n"
    text = t + text
    # print(ro(correctR[0], 12) + ', ' + ro(correctR[0], 12) + ', ' + ro(correctR[1], 12) + ', ' + ro(correctR[3], 12) + ', ' + ro(correct, 48))
    data['correctAll'] = correct
    data['correctID_fibers'] = correctIDf
    data['correctID_manix'] = correctIDm
    data['correctRenderers'] = correctR


    correctALL += correct
    correctIDf_ALL = list(map(add, correctIDf_ALL, correctIDf))
    correctIDm_ALL = list(map(add, correctIDm_ALL, correctIDm))
    correctR_ALL = list(map(add, correctR_ALL, correctR))

    # data['results'] = save
    #print(save)
    with open(path + filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

print(first)
print(firstAll)
print(first/firstAll)

print("-------------")
print(text)

print(correctIDf_ALL)
print(correctIDm_ALL)
print(correctR_ALL)

# resultData = {
#     "correctAll": correctALL,
#     "correctID_fibers": correctIDf_ALL,
#     "correctID_manix": correctIDm_ALL,
#     "correctRenderers": correctR_ALL,
#     "correctAll_%": correctALL / (48 * 20),
#     "correctID_fibers_%": [x / (4 * 20) for x in correctIDf_ALL],
#     "correctID_manix_%": [x / (4 * 20) for x in correctIDm_ALL],
#     "correctRenderers_%": [x / (12 * 20) for x in correctR_ALL],
# }

# with open(path + r'\results2.json', "w", encoding="utf-8") as f:
#     json.dump(resultData, f, indent=4)